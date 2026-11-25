import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	compareSemver,
	findMatchingReleaseAsset,
	getPortableRuntimeInfo
} from './portable-updater.ts';

const SAVED_ENV = { ...process.env };
const tempDirs: string[] = [];

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in SAVED_ENV)) delete process.env[key];
	}
	Object.assign(process.env, SAVED_ENV);
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe('portable updater helpers', () => {
	it('compares semantic versions accurately with or without v prefix', () => {
		expect(compareSemver('v1.0.2', 'v1.0.1')).toBe(1);
		expect(compareSemver('v1.0.10', 'v1.0.2')).toBe(1);
		expect(compareSemver('1.1.0', 'v1.0.9')).toBe(1);
		expect(compareSemver('v1.0.1', '1.0.1')).toBe(0);
		expect(compareSemver('v1.0.1', 'v1.0.2')).toBe(-1);
		expect(compareSemver('v1.9.9', 'v2.0.0')).toBe(-1);
	});

	it('matches only verified GitHub release assets for the active portable platform', () => {
		const assets = [
			{
				name: 'CertFlow-v1.1.0-win-x64.zip',
				size: 74_000_000,
				browser_download_url:
					'https://github.com/FishyWeed/CertFlow/releases/download/v1.1.0/CertFlow-v1.1.0-win-x64.zip'
			},
			{
				name: 'CertFlow-v1.1.0-darwin-arm64.zip',
				size: 77_000_000,
				browser_download_url:
					'https://evil.example.com/CertFlow-v1.1.0-darwin-arm64.zip'
			}
		];

		expect(findMatchingReleaseAsset(assets, 'win-x64', 'FishyWeed/CertFlow')?.name).toBe(
			'CertFlow-v1.1.0-win-x64.zip'
		);
		// Untrusted host URL is rejected even if filename matches.
		expect(findMatchingReleaseAsset(assets, 'darwin-arm64', 'FishyWeed/CertFlow')).toBeNull();
		expect(findMatchingReleaseAsset(assets, 'linux-x64', 'FishyWeed/CertFlow')).toBeNull();
	});

	it('detects portable runtime only when portable layout and flags exist and never on managed cloud', () => {
		delete process.env.CERTFLOW_PORTABLE;
		delete process.env.CERTFLOW_PORTABLE_ROOT;
		delete process.env.CERTFLOW_APP_DIR;
		expect(getPortableRuntimeInfo().isPortable).toBe(false);

		const root = mkdtempSync(join(tmpdir(), 'certflow-portable-test-'));
		tempDirs.push(root);
		mkdirSync(join(root, 'app', 'build'), { recursive: true });
		mkdirSync(join(root, 'data'), { recursive: true });
		writeFileSync(join(root, 'app', 'build', 'index.js'), '');
		writeFileSync(
			join(root, 'app', 'portable-meta.json'),
			JSON.stringify({
				portable: true,
				version: 'v1.0.2',
				target: 'win-x64',
				repo: 'FishyWeed/CertFlow'
			})
		);

		process.env.CERTFLOW_PORTABLE = 'true';
		process.env.CERTFLOW_PORTABLE_ROOT = root;
		process.env.CERTFLOW_APP_DIR = join(root, 'app');

		const info = getPortableRuntimeInfo();
		expect(info.isPortable).toBe(true);
		expect(info.currentVersion).toBe('v1.0.2');
		expect(info.target).toBe('win-x64');

		// Managed cloud hosts always disable portable updater even if env vars are present.
		process.env.RAILWAY_ENVIRONMENT = 'production';
		expect(getPortableRuntimeInfo().isPortable).toBe(false);
	});
});
