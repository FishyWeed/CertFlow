import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const INSECURE_DEFAULT_AUTH_SECRET = 'dev-insecure-secret-change-me-in-production-32chars';
export const INSECURE_DEFAULT_ENCRYPTION_KEY =
	'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export interface PersistedRuntimeConfig {
	setupCompleted: boolean;
	configuredAt?: string;
	databaseUrl?: string;
	betterAuthUrl?: string;
	betterAuthSecret?: string;
	encryptionKey?: string;
	storageDriver?: string;
	localUploadDir?: string;
	brevoApiKey?: string;
	resendApiKey?: string;
	smtpHost?: string;
	smtpPort?: number;
	smtpSecure?: boolean;
	smtpUser?: string;
	smtpPass?: string;
	defaultFromName?: string;
	defaultFromEmail?: string;
	allowCustomSmtp?: boolean;
}

export interface EffectiveRuntimeConfig {
	databaseUrl: string;
	betterAuthUrl: string;
	betterAuthSecret: string;
	encryptionKey: string;
	storageDriver: string;
	localUploadDir: string;
	brevoApiKey: string;
	resendApiKey: string;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	smtpUser: string;
	smtpPass: string;
	defaultFromName: string;
	defaultFromEmail: string;
	allowCustomSmtp: boolean;
	setupCompleted: boolean;
}

let cachedFilePath: string | null = null;
let cachedFileConfig: PersistedRuntimeConfig | null = null;

export function getConfigFilePath(): string {
	if (process.env.CERTFLOW_CONFIG_PATH?.trim()) {
		return resolve(process.env.CERTFLOW_CONFIG_PATH.trim());
	}
	const dataDir = process.env.CERTFLOW_DATA_DIR?.trim() || './.local';
	return resolve(join(dataDir, 'config.json'));
}

export function generateAuthSecret(): string {
	return randomBytes(32).toString('hex');
}

export function generateEncryptionKey(): string {
	return randomBytes(32).toString('hex');
}

export function clearRuntimeConfigCache(): void {
	cachedFilePath = null;
	cachedFileConfig = null;
}

export function readPersistedRuntimeConfig(): PersistedRuntimeConfig | null {
	const filePath = getConfigFilePath();
	if (cachedFilePath === filePath && cachedFileConfig !== null) {
		return cachedFileConfig;
	}
	if (!existsSync(filePath)) {
		return null;
	}
	try {
		const raw = readFileSync(filePath, 'utf8');
		const parsed = JSON.parse(raw) as PersistedRuntimeConfig;
		cachedFilePath = filePath;
		cachedFileConfig = parsed;
		return parsed;
	} catch {
		return null;
	}
}

function isRealSecret(value: string | undefined, insecureDefault: string): boolean {
	const trimmed = (value ?? '').trim();
	return trimmed.length >= 32 && trimmed !== insecureDefault && !trimmed.startsWith('replace-with-');
}

function isRailwayHosted(): boolean {
	return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
}

/**
 * Returns true only for fresh self-hosted Docker launches that have neither completed `/setup`
 * nor supplied production secrets via environment variables.
 * Railway deployments and standard local `pnpm dev` always return false.
 */
export function needsInitialSetup(): boolean {
	if (isRailwayHosted() || process.env.CERTFLOW_SELF_HOSTED !== 'true') {
		return false;
	}

	const saved = readPersistedRuntimeConfig();
	if (saved?.setupCompleted) {
		return false;
	}

	const hasEnvSecrets =
		isRealSecret(process.env.BETTER_AUTH_SECRET, INSECURE_DEFAULT_AUTH_SECRET) &&
		isRealSecret(process.env.ENCRYPTION_KEY, INSECURE_DEFAULT_ENCRYPTION_KEY);

	return !hasEnvSecrets;
}

export function getRuntimeConfig(): EffectiveRuntimeConfig {
	const saved = readPersistedRuntimeConfig();
	const dataDir = process.env.CERTFLOW_DATA_DIR?.trim();
	const defaultDbPath = dataDir ? join(dataDir, 'pgdata') : './.local/pgdata';
	const defaultUploadsDir = dataDir ? join(dataDir, 'uploads') : './uploads';

	const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
		? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
		: '';

	const envAuthUrl = process.env.BETTER_AUTH_URL?.trim();
	const betterAuthUrl =
		saved?.betterAuthUrl?.trim() ||
		(envAuthUrl && envAuthUrl !== 'http://localhost:5678' ? envAuthUrl : '') ||
		railwayUrl ||
		envAuthUrl ||
		'http://localhost:5678';

	const smtpPortRaw = saved?.smtpPort ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025);
	const smtpPort = Number.isFinite(smtpPortRaw) && smtpPortRaw > 0 ? smtpPortRaw : 1025;

	return {
		databaseUrl: saved?.databaseUrl?.trim() || process.env.DATABASE_URL?.trim() || defaultDbPath,
		betterAuthUrl,
		betterAuthSecret:
			saved?.betterAuthSecret?.trim() ||
			process.env.BETTER_AUTH_SECRET?.trim() ||
			INSECURE_DEFAULT_AUTH_SECRET,
		encryptionKey:
			saved?.encryptionKey?.trim() ||
			process.env.ENCRYPTION_KEY?.trim() ||
			INSECURE_DEFAULT_ENCRYPTION_KEY,
		storageDriver: saved?.storageDriver?.trim() || process.env.STORAGE_DRIVER?.trim() || 'local',
		localUploadDir:
			saved?.localUploadDir?.trim() || process.env.LOCAL_UPLOAD_DIR?.trim() || defaultUploadsDir,
		brevoApiKey: saved?.brevoApiKey?.trim() || process.env.BREVO_API_KEY?.trim() || '',
		resendApiKey: saved?.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim() || '',
		smtpHost: saved?.smtpHost?.trim() || process.env.SMTP_HOST?.trim() || 'local-outbox',
		smtpPort,
		smtpSecure:
			saved?.smtpSecure !== undefined ? saved.smtpSecure : process.env.SMTP_SECURE === 'true',
		smtpUser: saved?.smtpUser?.trim() || process.env.SMTP_USER?.trim() || '',
		smtpPass: saved?.smtpPass ?? process.env.SMTP_PASS ?? '',
		defaultFromName:
			saved?.defaultFromName?.trim() || process.env.DEFAULT_FROM_NAME?.trim() || 'CertFlow',
		defaultFromEmail:
			saved?.defaultFromEmail?.trim() ||
			process.env.DEFAULT_FROM_EMAIL?.trim() ||
			'certificates@certflow.local',
		allowCustomSmtp:
			saved?.allowCustomSmtp !== undefined
				? saved.allowCustomSmtp
				: process.env.ALLOW_CUSTOM_SMTP === 'true' ||
					(process.env.CERTFLOW_SELF_HOSTED === 'true' && !isRailwayHosted()),
		setupCompleted: Boolean(saved?.setupCompleted)
	};
}

/**
 * Persists self-hosted configuration to `/data/config.json` (mode 0600) and updates the live cache.
 */
export function saveRuntimeConfig(config: PersistedRuntimeConfig): EffectiveRuntimeConfig {
	const filePath = getConfigFilePath();
	mkdirSync(dirname(filePath), { recursive: true });

	const payload: PersistedRuntimeConfig = {
		...config,
		setupCompleted: true,
		configuredAt: config.configuredAt ?? new Date().toISOString()
	};

	writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
		encoding: 'utf8',
		mode: 0o600
	});

	cachedFilePath = filePath;
	cachedFileConfig = payload;

	// Mirror non-empty values into process.env so libraries reading process.env stay in sync.
	if (payload.databaseUrl) process.env.DATABASE_URL = payload.databaseUrl;
	if (payload.betterAuthUrl) {
		process.env.BETTER_AUTH_URL = payload.betterAuthUrl;
		process.env.PUBLIC_APP_URL = payload.betterAuthUrl;
	}
	if (payload.betterAuthSecret) process.env.BETTER_AUTH_SECRET = payload.betterAuthSecret;
	if (payload.encryptionKey) process.env.ENCRYPTION_KEY = payload.encryptionKey;
	if (payload.localUploadDir) process.env.LOCAL_UPLOAD_DIR = payload.localUploadDir;
	if (payload.brevoApiKey) process.env.BREVO_API_KEY = payload.brevoApiKey;
	if (payload.resendApiKey) process.env.RESEND_API_KEY = payload.resendApiKey;
	if (payload.smtpHost) process.env.SMTP_HOST = payload.smtpHost;
	if (payload.smtpPort) process.env.SMTP_PORT = String(payload.smtpPort);
	if (payload.smtpSecure !== undefined) process.env.SMTP_SECURE = String(payload.smtpSecure);
	if (payload.smtpUser) process.env.SMTP_USER = payload.smtpUser;
	if (payload.smtpPass) process.env.SMTP_PASS = payload.smtpPass;
	if (payload.defaultFromName) process.env.DEFAULT_FROM_NAME = payload.defaultFromName;
	if (payload.defaultFromEmail) process.env.DEFAULT_FROM_EMAIL = payload.defaultFromEmail;

	return getRuntimeConfig();
}
