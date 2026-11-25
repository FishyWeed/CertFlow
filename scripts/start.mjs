import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
process.env.CERTFLOW_APP_DIR ??= APP_ROOT;

// Set safe production defaults for @sveltejs/adapter-node before loading the built server.
process.env.NODE_ENV ??= 'production';
process.env.HOST ??= '0.0.0.0';
process.env.BODY_SIZE_LIMIT ??= '50M';
process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
process.env.HOST_HEADER ??= 'x-forwarded-host';

const INSECURE_AUTH_SECRET = 'dev-insecure-secret-change-me-in-production-32chars';
const INSECURE_ENC_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function loadPersistedSetupConfig() {
	const configPath = process.env.CERTFLOW_CONFIG_PATH?.trim()
		? resolve(process.env.CERTFLOW_CONFIG_PATH.trim())
		: resolve(join(process.env.CERTFLOW_DATA_DIR?.trim() || './.local', 'config.json'));

	if (!existsSync(configPath)) return null;
	try {
		const saved = JSON.parse(readFileSync(configPath, 'utf8'));
		if (saved.databaseUrl) process.env.DATABASE_URL = saved.databaseUrl;
		if (saved.betterAuthUrl) {
			process.env.BETTER_AUTH_URL = saved.betterAuthUrl;
			process.env.PUBLIC_APP_URL = saved.betterAuthUrl;
		}
		if (saved.betterAuthSecret) process.env.BETTER_AUTH_SECRET = saved.betterAuthSecret;
		if (saved.encryptionKey) process.env.ENCRYPTION_KEY = saved.encryptionKey;
		if (saved.storageDriver) process.env.STORAGE_DRIVER = saved.storageDriver;
		if (saved.localUploadDir) process.env.LOCAL_UPLOAD_DIR = saved.localUploadDir;
		if (saved.brevoApiKey) process.env.BREVO_API_KEY = saved.brevoApiKey;
		if (saved.resendApiKey) process.env.RESEND_API_KEY = saved.resendApiKey;
		if (saved.smtpHost) process.env.SMTP_HOST = saved.smtpHost;
		if (saved.smtpPort) process.env.SMTP_PORT = String(saved.smtpPort);
		if (saved.smtpSecure !== undefined) process.env.SMTP_SECURE = String(saved.smtpSecure);
		if (saved.smtpUser) process.env.SMTP_USER = saved.smtpUser;
		if (saved.smtpPass) process.env.SMTP_PASS = saved.smtpPass;
		if (saved.defaultFromName) process.env.DEFAULT_FROM_NAME = saved.defaultFromName;
		if (saved.defaultFromEmail) process.env.DEFAULT_FROM_EMAIL = saved.defaultFromEmail;
		if (saved.allowCustomSmtp !== undefined) {
			process.env.ALLOW_CUSTOM_SMTP = String(saved.allowCustomSmtp);
		}
		return saved;
	} catch (err) {
		console.warn('[certflow] Could not parse persisted config.json:', err);
		return null;
	}
}

function isRealSecret(value, insecureDefault) {
	const trimmed = (value ?? '').trim();
	return trimmed.length >= 32 && trimmed !== insecureDefault && !trimmed.startsWith('replace-with-');
}

const savedConfig = loadPersistedSetupConfig();

const isManagedCloud = Boolean(
	process.env.RAILWAY_ENVIRONMENT ||
		process.env.RAILWAY_PROJECT_ID ||
		process.env.RENDER === 'true' ||
		process.env.RENDER_EXTERNAL_URL
);

const isSelfHostedUnconfigured =
	!isManagedCloud &&
	process.env.CERTFLOW_SELF_HOSTED === 'true' &&
	!savedConfig?.setupCompleted &&
	!(
		isRealSecret(process.env.BETTER_AUTH_SECRET, INSECURE_AUTH_SECRET) &&
		isRealSecret(process.env.ENCRYPTION_KEY, INSECURE_ENC_KEY)
	);

const port = process.env.PORT || '3000';
const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
	? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
	: null;
const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim() || null;
const authUrl = process.env.BETTER_AUTH_URL || railwayUrl || renderUrl || `http://localhost:${port}`;

// @sveltejs/adapter-node defaults request protocol to "https" when x-forwarded-proto is absent.
// On direct local HTTP (Portable app and local Docker), set ORIGIN so SvelteKit CSRF checks match http://localhost:<port>.
if (!isManagedCloud && !process.env.ORIGIN) {
	if (authUrl.startsWith('http://')) {
		process.env.ORIGIN = authUrl.replace(/\/+$/, '');
	}
}

if (isSelfHostedUnconfigured) {
	console.log(`[certflow] First-run setup required. Open http://localhost:${port}/setup to configure CertFlow.`);
} else {
	console.log(`[certflow] Auth base URL: ${authUrl}`);
	const dbUrl = (process.env.DATABASE_URL ?? '').trim();
	const migrationsFolder = join(APP_ROOT, 'drizzle');

	if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
		console.log('[certflow] Database mode: PostgreSQL. Running migrations...');
		const migrationClient = postgres(dbUrl, { max: 1 });
		try {
			await migratePostgres(drizzlePostgres(migrationClient), { migrationsFolder });
			console.log('[certflow] PostgreSQL migrations complete.');
		} finally {
			await migrationClient.end();
		}
	} else if (process.env.CERTFLOW_SELF_HOSTED === 'true') {
		const dataDir = resolve(
			dbUrl.replace(/^pglite:\/\//, '') ||
				join(process.env.CERTFLOW_DATA_DIR?.trim() || '/data', 'pgdata')
		);
		console.log(`[certflow] Database mode: Embedded PostgreSQL (${dataDir}). Running migrations...`);
		mkdirSync(dataDir, { recursive: true });
		const pgliteClient = new PGlite(dataDir);
		try {
			await migratePglite(drizzlePglite(pgliteClient), { migrationsFolder });
			console.log('[certflow] Embedded PostgreSQL migrations complete.');
		} finally {
			await pgliteClient.close();
		}
	} else {
		console.warn(
			'[certflow] WARNING: DATABASE_URL is not a postgresql:// URL. Set DATABASE_URL to your PostgreSQL connection string.'
		);
	}
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		console.log(`[certflow] Received ${signal}. Shutting down cleanly...`);
		setTimeout(() => process.exit(0), 250).unref();
	});
}

await import('../build/index.js');
