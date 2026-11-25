import { randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import {
	formatBytes,
	MAX_STORAGE_BYTES_PER_USER,
	MAX_UPLOAD_BYTES
} from '#lib/config/limits.ts';
import { getUserAccountUsage } from '#lib/server/asset-cleanup.ts';
import { db } from '#lib/server/db/index.ts';
import { assets } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import { getStorage } from '#lib/server/storage.ts';
import type { RequestHandler } from './$types';

const ALLOWED_IMAGE_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/svg+xml'
]);

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const formData = await request.formData();
	const file = formData.get('file');
	const kindRaw = String(formData.get('kind') ?? 'image');
	const projectIdRaw = formData.get('projectId');
	const projectId = typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null;

	if (!(file instanceof File)) {
		throw error(400, 'Missing file field');
	}
	if (!['background', 'image', 'font'].includes(kindRaw)) {
		throw error(400, 'Invalid asset kind');
	}
	if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
		throw error(400, 'File must be between 1 byte and 10 MB');
	}
	if (kindRaw !== 'font' && !ALLOWED_IMAGE_TYPES.has(file.type)) {
		throw error(400, 'Only PNG, JPG, WebP or SVG images are allowed');
	}

	if (projectId) {
		await requireOwnedProject(projectId, locals.user.id);
	}

	const usage = await getUserAccountUsage(locals.user.id);
	if (usage.storageUsedBytes + file.size > MAX_STORAGE_BYTES_PER_USER) {
		throw error(
			413,
			`Storage limit reached (${formatBytes(usage.storageUsedBytes)} of ${formatBytes(MAX_STORAGE_BYTES_PER_USER)} used). Clean up unused files in Account Settings or delete an older project.`
		);
	}

	const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
	const id = randomUUID();
	const storageKey = `${locals.user.id}/${projectId ?? 'shared'}/${id}.${ext}`;
	const bytes = new Uint8Array(await file.arrayBuffer());

	const storage = getStorage();
	const stored = await storage.put(storageKey, bytes, file.type || 'application/octet-stream');

	const [record] = await db
		.insert(assets)
		.values({
			id,
			userId: locals.user.id,
			projectId,
			kind: kindRaw as 'background' | 'image' | 'font',
			fileName: file.name,
			mimeType: file.type || 'application/octet-stream',
			sizeBytes: file.size,
			storageKey: stored.storageKey,
			publicUrl: stored.publicUrl
		})
		.returning();

	return json({ asset: record }, { status: 201 });
};
