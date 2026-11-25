import { count, eq, inArray, sql } from 'drizzle-orm';
import { MAX_PROJECTS_PER_USER, MAX_STORAGE_BYTES_PER_USER } from '#lib/config/limits.ts';
import type { TemplateCanvasState } from '#lib/types/certflow.ts';
import { db } from './db/index.ts';
import { assets, projects, templates } from './db/schema.ts';
import { isLocalAppRuntime } from './runtime-config.ts';
import { getStorage } from './storage.ts';

const ASSET_FILE_PREFIX = '/api/assets/file/';
const DEFAULT_PRUNE_GRACE_MS = 15 * 60 * 1000; // 15 minutes

export interface AccountUsageSummary {
	projectCount: number;
	maxProjects: number | null;
	storageUsedBytes: number;
	maxStorageBytes: number | null;
	assetCount: number;
	isUnlimited: boolean;
}

function extractStorageKeyFromUrl(url: string | undefined): string | null {
	if (!url || !url.startsWith(ASSET_FILE_PREFIX)) return null;
	try {
		return decodeURIComponent(url.slice(ASSET_FILE_PREFIX.length));
	} catch {
		return null;
	}
}

/**
 * Collects every asset ID and storage key referenced anywhere inside the provided template states.
 */
export function collectReferencedAssets(canvasStates: TemplateCanvasState[]): {
	assetIds: Set<string>;
	storageKeys: Set<string>;
} {
	const assetIds = new Set<string>();
	const storageKeys = new Set<string>();

	const addRef = (id?: string, url?: string) => {
		if (id) assetIds.add(id);
		const key = extractStorageKeyFromUrl(url);
		if (key) storageKeys.add(key);
	};

	for (const state of canvasStates) {
		if (!state) continue;
		if (state.background) {
			addRef(state.background.assetId, state.background.imageUrl);
			addRef(state.background.originalAssetId, state.background.originalImageUrl);
		}
		for (const el of state.elements ?? []) {
			if (el.type === 'image' || el.type === 'signature') {
				addRef(el.assetId, el.src);
				addRef(el.originalAssetId, el.originalSrc);
			}
		}
	}

	return { assetIds, storageKeys };
}

/**
 * Returns live project count and asset storage usage for an account.
 */
export async function getUserAccountUsage(userId: string): Promise<AccountUsageSummary> {
	const [[projectRow], [assetRow]] = await Promise.all([
		db
			.select({ total: count() })
			.from(projects)
			.where(eq(projects.userId, userId)),
		db
			.select({
				assetCount: count(),
				totalBytes: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)`
			})
			.from(assets)
			.where(eq(assets.userId, userId))
	]);

	const unlimited = isLocalAppRuntime();

	return {
		projectCount: Number(projectRow?.total ?? 0),
		maxProjects: unlimited ? null : MAX_PROJECTS_PER_USER,
		storageUsedBytes: Number(assetRow?.totalBytes ?? 0),
		maxStorageBytes: unlimited ? null : MAX_STORAGE_BYTES_PER_USER,
		assetCount: Number(assetRow?.assetCount ?? 0),
		isUnlimited: unlimited
	};
}

/**
 * Deletes every file stored on disk/object storage for a project before removing its DB row.
 */
export async function deleteProjectAssetsFromStorage(projectId: string): Promise<{
	deletedCount: number;
	freedBytes: number;
}> {
	const projectAssets = await db
		.select({
			id: assets.id,
			storageKey: assets.storageKey,
			sizeBytes: assets.sizeBytes
		})
		.from(assets)
		.where(eq(assets.projectId, projectId));

	if (projectAssets.length === 0) {
		return { deletedCount: 0, freedBytes: 0 };
	}

	const storage = getStorage();
	await Promise.all(projectAssets.map((item) => storage.delete(item.storageKey).catch(() => {})));

	const freedBytes = projectAssets.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
	return { deletedCount: projectAssets.length, freedBytes };
}

/**
 * Deletes unreferenced uploaded assets belonging to one project.
 * Uses a grace window by default so recent unsaved uploads in another tab are not removed.
 */
export async function pruneUnusedProjectAssets(
	projectId: string,
	options?: { graceMs?: number }
): Promise<{ deletedCount: number; freedBytes: number }> {
	const graceMs = options?.graceMs ?? DEFAULT_PRUNE_GRACE_MS;

	const [projectTemplates, projectAssets] = await Promise.all([
		db
			.select({ canvasState: templates.canvasState })
			.from(templates)
			.where(eq(templates.projectId, projectId)),
		db
			.select({
				id: assets.id,
				storageKey: assets.storageKey,
				sizeBytes: assets.sizeBytes,
				createdAt: assets.createdAt
			})
			.from(assets)
			.where(eq(assets.projectId, projectId))
	]);

	if (projectAssets.length === 0) {
		return { deletedCount: 0, freedBytes: 0 };
	}

	const { assetIds, storageKeys } = collectReferencedAssets(
		projectTemplates.map((t) => t.canvasState)
	);
	const cutoff = Date.now() - graceMs;

	const unused = projectAssets.filter((item) => {
		if (assetIds.has(item.id) || storageKeys.has(item.storageKey)) return false;
		if (graceMs > 0 && item.createdAt.getTime() > cutoff) return false;
		return true;
	});

	if (unused.length === 0) {
		return { deletedCount: 0, freedBytes: 0 };
	}

	const storage = getStorage();
	await Promise.all(unused.map((item) => storage.delete(item.storageKey).catch(() => {})));
	await db
		.delete(assets)
		.where(inArray(assets.id, unused.map((u) => u.id)));

	const freedBytes = unused.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
	return { deletedCount: unused.length, freedBytes };
}

/**
 * Immediately deletes every asset owned by `userId` that is not referenced by any template
 * across any of their projects (including orphaned uploads with null projectId).
 */
export async function pruneUnusedUserAssets(userId: string): Promise<{
	deletedCount: number;
	freedBytes: number;
}> {
	const [userProjects, userAssets] = await Promise.all([
		db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)),
		db
			.select({
				id: assets.id,
				storageKey: assets.storageKey,
				sizeBytes: assets.sizeBytes
			})
			.from(assets)
			.where(eq(assets.userId, userId))
	]);

	if (userAssets.length === 0) {
		return { deletedCount: 0, freedBytes: 0 };
	}

	const projectIds = userProjects.map((p) => p.id);
	const userTemplates =
		projectIds.length > 0
			? await db
					.select({ canvasState: templates.canvasState })
					.from(templates)
					.where(inArray(templates.projectId, projectIds))
			: [];

	const { assetIds, storageKeys } = collectReferencedAssets(
		userTemplates.map((t) => t.canvasState)
	);

	const unused = userAssets.filter(
		(item) => !assetIds.has(item.id) && !storageKeys.has(item.storageKey)
	);

	if (unused.length === 0) {
		return { deletedCount: 0, freedBytes: 0 };
	}

	const storage = getStorage();
	await Promise.all(unused.map((item) => storage.delete(item.storageKey).catch(() => {})));
	await db
		.delete(assets)
		.where(inArray(assets.id, unused.map((u) => u.id)));

	const freedBytes = unused.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
	return { deletedCount: unused.length, freedBytes };
}
