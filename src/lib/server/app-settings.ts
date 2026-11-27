import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
	MAX_PROJECTS_PER_USER,
	MAX_RECIPIENTS_PER_PROJECT,
	MAX_STORAGE_BYTES_PER_USER,
	MAX_UPLOAD_BYTES
} from '#lib/config/limits.ts';
import { db } from './db/index.ts';
import { appSettings, user } from './db/schema.ts';
import { isLocalAppRuntime } from './runtime-config.ts';

export const QUOTA_SETTINGS_KEY = 'quota_limits';

export const MB = 1024 * 1024;
export const MAX_ALLOWED_PROJECTS_LIMIT = 100_000;
export const MAX_ALLOWED_STORAGE_MB = 102_400; // 100 GB
export const MAX_ALLOWED_UPLOAD_MB = 1_024; // 1 GB
export const MAX_ALLOWED_RECIPIENTS_LIMIT = 1_000_000;

export interface QuotaLimits {
	/** null means no limit (unlimited). */
	maxProjectsPerUser: number | null;
	/** null means no limit (unlimited). */
	maxStorageBytesPerUser: number | null;
	/** null means no limit (unlimited). */
	maxUploadBytes: number | null;
	/** null means no limit (unlimited). */
	maxRecipientsPerProject: number | null;
}

export interface QuotaSettingsSnapshot {
	limits: QuotaLimits;
	defaults: QuotaLimits;
	isCustomised: boolean;
	isLocalRuntime: boolean;
}

export const quotaLimitsInputSchema = z.object({
	maxProjectsPerUser: z.number().int().min(1).max(MAX_ALLOWED_PROJECTS_LIMIT).nullable(),
	maxStorageBytesPerUser: z
		.number()
		.int()
		.min(MB)
		.max(MAX_ALLOWED_STORAGE_MB * MB)
		.nullable(),
	maxUploadBytes: z
		.number()
		.int()
		.min(MB)
		.max(MAX_ALLOWED_UPLOAD_MB * MB)
		.nullable(),
	maxRecipientsPerProject: z.number().int().min(1).max(MAX_ALLOWED_RECIPIENTS_LIMIT).nullable()
});

let tableEnsured = false;
let cachedOverride: { loaded: boolean; value: QuotaLimits | null; loadedAt: number } = {
	loaded: false,
	value: null,
	loadedAt: 0
};
const CACHE_TTL_MS = 10_000;

export function clearQuotaSettingsCache(): void {
	cachedOverride = { loaded: false, value: null, loadedAt: 0 };
}

/**
 * Returns default quota limits for the current runtime (unlimited locally, guarded defaults on hosted cloud).
 */
export function getDefaultQuotaLimits(localRuntime = isLocalAppRuntime()): QuotaLimits {
	if (localRuntime) {
		return {
			maxProjectsPerUser: null,
			maxStorageBytesPerUser: null,
			maxUploadBytes: null,
			maxRecipientsPerProject: null
		};
	}
	return {
		maxProjectsPerUser: MAX_PROJECTS_PER_USER,
		maxStorageBytesPerUser: MAX_STORAGE_BYTES_PER_USER,
		maxUploadBytes: MAX_UPLOAD_BYTES,
		maxRecipientsPerProject: MAX_RECIPIENTS_PER_PROJECT
	};
}

/**
 * Parses a stored JSON payload into validated QuotaLimits, falling back per field to defaults.
 */
export function normaliseStoredQuotaLimits(
	raw: unknown,
	defaults: QuotaLimits
): QuotaLimits {
	if (!raw || typeof raw !== 'object') return { ...defaults };
	const record = raw as Record<string, unknown>;

	const parseNullableInt = (
		val: unknown,
		fallback: number | null,
		min: number,
		max: number
	): number | null => {
		if (val === null) return null;
		if (typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max) {
			return val;
		}
		return fallback;
	};

	return {
		maxProjectsPerUser: parseNullableInt(
			record.maxProjectsPerUser,
			defaults.maxProjectsPerUser,
			1,
			MAX_ALLOWED_PROJECTS_LIMIT
		),
		maxStorageBytesPerUser: parseNullableInt(
			record.maxStorageBytesPerUser,
			defaults.maxStorageBytesPerUser,
			MB,
			MAX_ALLOWED_STORAGE_MB * MB
		),
		maxUploadBytes: parseNullableInt(
			record.maxUploadBytes,
			defaults.maxUploadBytes,
			MB,
			MAX_ALLOWED_UPLOAD_MB * MB
		),
		maxRecipientsPerProject: parseNullableInt(
			record.maxRecipientsPerProject,
			defaults.maxRecipientsPerProject,
			1,
			MAX_ALLOWED_RECIPIENTS_LIMIT
		)
	};
}

async function ensureAppSettingsTable(): Promise<void> {
	if (tableEnsured) return;
	await db.execute(sql`
		CREATE TABLE IF NOT EXISTS "app_settings" (
			"key" text PRIMARY KEY NOT NULL,
			"value" jsonb NOT NULL,
			"updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
			"updated_at" timestamp with time zone DEFAULT now() NOT NULL
		)
	`);
	tableEnsured = true;
}

/**
 * Parses comma-separated ADMIN_EMAILS from the environment into a lowercased set.
 */
export function parseAdminEmailAllowlist(raw = process.env.ADMIN_EMAILS ?? ''): Set<string> {
	const set = new Set<string>();
	for (const part of raw.split(',')) {
		const cleaned = part.trim().toLowerCase();
		if (cleaned) set.add(cleaned);
	}
	return set;
}

/**
 * Checks whether a signed-in user is an instance administrator.
 * If ADMIN_EMAILS is configured, membership in that list decides admin status.
 * Otherwise, the first registered account (instance owner) is automatically the administrator.
 */
export async function isUserAdmin(accountUser: {
	id: string;
	email?: string | null;
}): Promise<boolean> {
	const allowlist = parseAdminEmailAllowlist();
	if (allowlist.size > 0) {
		const email = (accountUser.email ?? '').trim().toLowerCase();
		return Boolean(email && allowlist.has(email));
	}

	const [firstUser] = await db
		.select({ id: user.id })
		.from(user)
		.orderBy(asc(user.createdAt), asc(user.id))
		.limit(1);

	return firstUser?.id === accountUser.id;
}

async function readQuotaOverrideFromDb(): Promise<QuotaLimits | null> {
	const now = Date.now();
	if (cachedOverride.loaded && now - cachedOverride.loadedAt < CACHE_TTL_MS) {
		return cachedOverride.value;
	}

	await ensureAppSettingsTable();
	const [row] = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, QUOTA_SETTINGS_KEY))
		.limit(1);

	const defaults = getDefaultQuotaLimits();
	const parsed = row ? normaliseStoredQuotaLimits(row.value, defaults) : null;
	cachedOverride = { loaded: true, value: parsed, loadedAt: now };
	return parsed;
}

/**
 * Returns the active account quota limits for this deployment (admin override or runtime defaults).
 */
export async function getEffectiveQuotaLimits(): Promise<QuotaLimits> {
	const override = await readQuotaOverrideFromDb();
	if (override) return { ...override };
	return getDefaultQuotaLimits();
}

/**
 * Returns active limits alongside defaults and metadata for the Admin Settings screen.
 */
export async function getQuotaSettingsSnapshot(): Promise<QuotaSettingsSnapshot> {
	const localRuntime = isLocalAppRuntime();
	const defaults = getDefaultQuotaLimits(localRuntime);
	const override = await readQuotaOverrideFromDb();
	return {
		limits: override ? { ...override } : { ...defaults },
		defaults,
		isCustomised: override !== null,
		isLocalRuntime: localRuntime
	};
}

/**
 * Persists custom quota limits (including null for unlimited) in PostgreSQL / PGlite.
 */
export async function saveQuotaLimits(
	input: QuotaLimits,
	updatedByUserId: string
): Promise<QuotaSettingsSnapshot> {
	const validated = quotaLimitsInputSchema.parse(input);
	await ensureAppSettingsTable();

	await db
		.insert(appSettings)
		.values({
			key: QUOTA_SETTINGS_KEY,
			value: validated as unknown as Record<string, unknown>,
			updatedBy: updatedByUserId,
			updatedAt: new Date()
		})
		.onConflictDoUpdate({
			target: appSettings.key,
			set: {
				value: validated as unknown as Record<string, unknown>,
				updatedBy: updatedByUserId,
				updatedAt: new Date()
			}
		});

	cachedOverride = { loaded: true, value: { ...validated }, loadedAt: Date.now() };
	const localRuntime = isLocalAppRuntime();
	return {
		limits: { ...validated },
		defaults: getDefaultQuotaLimits(localRuntime),
		isCustomised: true,
		isLocalRuntime: localRuntime
	};
}

/**
 * Removes saved quota overrides so the deployment falls back to its runtime defaults.
 */
export async function resetQuotaLimits(): Promise<QuotaSettingsSnapshot> {
	await ensureAppSettingsTable();
	await db.delete(appSettings).where(eq(appSettings.key, QUOTA_SETTINGS_KEY));
	cachedOverride = { loaded: true, value: null, loadedAt: Date.now() };
	const localRuntime = isLocalAppRuntime();
	const defaults = getDefaultQuotaLimits(localRuntime);
	return {
		limits: { ...defaults },
		defaults,
		isCustomised: false,
		isLocalRuntime: localRuntime
	};
}
