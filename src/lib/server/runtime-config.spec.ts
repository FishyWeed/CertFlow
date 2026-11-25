import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	clearRuntimeConfigCache,
	generateAuthSecret,
	generateEncryptionKey,
	getRuntimeConfig,
	isLocalAppRuntime,
	needsInitialSetup,
	saveRuntimeConfig
} from './runtime-config.ts';

describe('runtime configuration and self-hosted setup detection', () => {
	let tempDir: string;
	const savedEnv: Record<string, string | undefined> = {};
	const envKeys = [
		'NODE_ENV',
		'CERTFLOW_SELF_HOSTED',
		'CERTFLOW_PORTABLE',
		'CERTFLOW_DATA_DIR',
		'CERTFLOW_CONFIG_PATH',
		'RAILWAY_ENVIRONMENT',
		'RAILWAY_PROJECT_ID',
		'RENDER',
		'RENDER_EXTERNAL_URL',
		'BETTER_AUTH_SECRET',
		'BETTER_AUTH_URL',
		'ENCRYPTION_KEY',
		'DATABASE_URL',
		'BREVO_API_KEY'
	];

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'certflow-cfg-'));
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
		process.env.CERTFLOW_DATA_DIR = tempDir;
		clearRuntimeConfigCache();
	});

	afterEach(() => {
		for (const key of envKeys) {
			if (savedEnv[key] === undefined) delete process.env[key];
			else process.env[key] = savedEnv[key];
		}
		clearRuntimeConfigCache();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('generates valid 64-char hex auth secrets and AES-256 encryption keys', () => {
		const authSecret = generateAuthSecret();
		const encKey = generateEncryptionKey();
		expect(authSecret).toMatch(/^[0-9a-f]{64}$/);
		expect(encKey).toMatch(/^[0-9a-f]{64}$/);
		expect(authSecret).not.toBe(encKey);
	});

	it('skips setup outside self-hosted Docker mode (Railway and local dev)', () => {
		expect(needsInitialSetup()).toBe(false);
	});

	it('requires setup on fresh self-hosted Docker boot without secrets, then unlocks once saved', () => {
		process.env.CERTFLOW_SELF_HOSTED = 'true';
		expect(needsInitialSetup()).toBe(true);

		const authSecret = generateAuthSecret();
		const encKey = generateEncryptionKey();
		saveRuntimeConfig({
			setupCompleted: true,
			betterAuthUrl: 'https://certs.example.org',
			betterAuthSecret: authSecret,
			encryptionKey: encKey,
			databaseUrl: join(tempDir, 'pgdata'),
			brevoApiKey: 'xkeysib-test-123'
		});

		expect(needsInitialSetup()).toBe(false);
		clearRuntimeConfigCache();
		expect(needsInitialSetup()).toBe(false);

		const cfg = getRuntimeConfig();
		expect(cfg.betterAuthUrl).toBe('https://certs.example.org');
		expect(cfg.betterAuthSecret).toBe(authSecret);
		expect(cfg.encryptionKey).toBe(encKey);
		expect(cfg.brevoApiKey).toBe('xkeysib-test-123');
	});

	it('skips setup in self-hosted mode when real secrets are passed via env vars', () => {
		process.env.CERTFLOW_SELF_HOSTED = 'true';
		process.env.BETTER_AUTH_SECRET = generateAuthSecret();
		process.env.ENCRYPTION_KEY = generateEncryptionKey();
		expect(needsInitialSetup()).toBe(false);
	});

	it('treats portable, local dev, local Docker and localhost builds as local apps, but enforces limits on Railway and Render', () => {
		// Local dev (NODE_ENV !== production)
		process.env.NODE_ENV = 'development';
		expect(isLocalAppRuntime()).toBe(true);

		// Portable Edition in production mode
		process.env.NODE_ENV = 'production';
		process.env.CERTFLOW_PORTABLE = 'true';
		expect(isLocalAppRuntime()).toBe(true);
		delete process.env.CERTFLOW_PORTABLE;

		// Local Docker self-hosted
		process.env.CERTFLOW_SELF_HOSTED = 'true';
		expect(isLocalAppRuntime()).toBe(true);
		delete process.env.CERTFLOW_SELF_HOSTED;

		// Localhost production run
		process.env.BETTER_AUTH_URL = 'http://localhost:3000';
		expect(isLocalAppRuntime()).toBe(true);

		// Public production domain without self-hosted flag
		process.env.BETTER_AUTH_URL = 'https://certs.example.org';
		expect(isLocalAppRuntime()).toBe(false);

		// Managed cloud hosts always enforce cloud limits even if self-hosted or portable flags exist
		process.env.CERTFLOW_SELF_HOSTED = 'true';
		process.env.RAILWAY_ENVIRONMENT = 'production';
		expect(isLocalAppRuntime()).toBe(false);
		delete process.env.RAILWAY_ENVIRONMENT;

		process.env.RENDER = 'true';
		expect(isLocalAppRuntime()).toBe(false);
	});

	it('auto-relocates local pgdata and uploads paths when a Portable data folder is moved', () => {
		process.env.CERTFLOW_PORTABLE = 'true';
		saveRuntimeConfig({
			setupCompleted: true,
			betterAuthUrl: 'http://localhost:3000',
			betterAuthSecret: generateAuthSecret(),
			encryptionKey: generateEncryptionKey(),
			databaseUrl: 'C:\\Old\\Downloads\\CertFlow\\data\\pgdata',
			localUploadDir: 'C:\\Old\\Downloads\\CertFlow\\data\\uploads'
		});
		clearRuntimeConfigCache();

		const cfg = getRuntimeConfig();
		expect(cfg.databaseUrl).toBe(join(tempDir, 'pgdata'));
		expect(cfg.localUploadDir).toBe(join(tempDir, 'uploads'));

		// Remote PostgreSQL URLs remain untouched even in Portable Edition.
		saveRuntimeConfig({
			setupCompleted: true,
			betterAuthUrl: 'http://localhost:3000',
			betterAuthSecret: generateAuthSecret(),
			encryptionKey: generateEncryptionKey(),
			databaseUrl: 'postgresql://user:pass@db.example.com:5432/certflow',
			localUploadDir: 'C:\\Old\\Downloads\\CertFlow\\data\\uploads'
		});
		clearRuntimeConfigCache();
		const remoteCfg = getRuntimeConfig();
		expect(remoteCfg.databaseUrl).toBe('postgresql://user:pass@db.example.com:5432/certflow');
		expect(remoteCfg.localUploadDir).toBe(join(tempDir, 'uploads'));
	});
});
