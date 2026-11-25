import { execFileSync, spawn } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { resetDatabaseConnection } from './db/index.ts';

export type PortableTarget = 'win-x64' | 'darwin-arm64' | 'darwin-x64' | 'linux-x64';

export interface PortableRuntimeInfo {
	isPortable: boolean;
	currentVersion: string;
	target: PortableTarget | '';
	rootDir: string;
	repo: string;
}

export interface GitHubReleaseAsset {
	name: string;
	size: number;
	browser_download_url: string;
}

export interface GitHubReleasePayload {
	tag_name: string;
	name?: string;
	html_url: string;
	body?: string;
	published_at?: string;
	assets?: GitHubReleaseAsset[];
}

export interface PortableUpdateCheckResult {
	currentVersion: string;
	latestVersion: string;
	updateAvailable: boolean;
	releaseUrl: string;
	releaseNotes: string;
	publishedAt: string | null;
	assetName: string | null;
	assetUrl: string | null;
	assetSizeBytes: number;
}

const DEFAULT_REPO = 'FishyWeed/CertFlow';
const VALID_TARGETS = new Set<PortableTarget>(['win-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64']);
let updateInProgress = false;

function isManagedCloud(): boolean {
	return Boolean(
		process.env.RAILWAY_ENVIRONMENT ||
			process.env.RAILWAY_PROJECT_ID ||
			process.env.RENDER === 'true' ||
			process.env.RENDER_EXTERNAL_URL
	);
}

/**
 * Compares two semantic version strings (with or without leading `v`).
 * Returns 1 if `a > b`, -1 if `a < b`, or 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
	const parse = (raw: string): [number, number, number] => {
		const cleaned = raw.trim().replace(/^v/i, '').split('-')[0] ?? '';
		const parts = cleaned.split('.').map((p) => Number.parseInt(p, 10));
		return [
			Number.isFinite(parts[0]) ? parts[0] : 0,
			Number.isFinite(parts[1]) ? parts[1] : 0,
			Number.isFinite(parts[2]) ? parts[2] : 0
		];
	};
	const [aMaj, aMin, aPat] = parse(a);
	const [bMaj, bMin, bPat] = parse(b);
	if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
	if (aMin !== bMin) return aMin > bMin ? 1 : -1;
	if (aPat !== bPat) return aPat > bPat ? 1 : -1;
	return 0;
}

function readPortableMeta(appDir: string): {
	portable?: boolean;
	version?: string;
	target?: string;
	repo?: string;
} | null {
	const metaPath = join(appDir, 'portable-meta.json');
	if (!existsSync(metaPath)) return null;
	try {
		return JSON.parse(readFileSync(metaPath, 'utf8')) as {
			portable?: boolean;
			version?: string;
			target?: string;
			repo?: string;
		};
	} catch {
		return null;
	}
}

/**
 * Detects whether CertFlow is running from a packaged Portable Desktop ZIP bundle.
 * Always returns `isPortable: false` on Railway, Render, Docker and local development.
 */
export function getPortableRuntimeInfo(): PortableRuntimeInfo {
	if (isManagedCloud()) {
		return { isPortable: false, currentVersion: '', target: '', rootDir: '', repo: DEFAULT_REPO };
	}

	const appDir = resolve(process.env.CERTFLOW_APP_DIR?.trim() || '.');
	const meta = readPortableMeta(appDir);
	const flaggedPortable = process.env.CERTFLOW_PORTABLE === 'true' || Boolean(meta?.portable);

	if (!flaggedPortable) {
		return { isPortable: false, currentVersion: '', target: '', rootDir: '', repo: DEFAULT_REPO };
	}

	const rawRoot = process.env.CERTFLOW_PORTABLE_ROOT?.trim() || resolve(appDir, '..');
	const rootDir = resolve(rawRoot);
	const rawTarget = (process.env.CERTFLOW_PORTABLE_TARGET?.trim() || meta?.target || '') as PortableTarget;
	const target: PortableTarget | '' = VALID_TARGETS.has(rawTarget) ? rawTarget : '';
	const currentVersion = (process.env.CERTFLOW_VERSION?.trim() || meta?.version || 'v1.0.0').trim();
	const repoCandidate = (meta?.repo || DEFAULT_REPO).trim();
	const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoCandidate) ? repoCandidate : DEFAULT_REPO;

	const hasExpectedLayout =
		Boolean(target) &&
		existsSync(join(rootDir, 'app', 'build', 'index.js')) &&
		existsSync(join(rootDir, 'data'));

	if (!hasExpectedLayout) {
		return { isPortable: false, currentVersion: '', target: '', rootDir: '', repo };
	}

	return {
		isPortable: true,
		currentVersion,
		target,
		rootDir,
		repo
	};
}

/**
 * Finds and validates the official GitHub Release ZIP asset matching this portable platform target.
 */
export function findMatchingReleaseAsset(
	assets: GitHubReleaseAsset[] | undefined,
	target: PortableTarget,
	repo: string
): GitHubReleaseAsset | null {
	if (!Array.isArray(assets)) return null;
	const expectedPrefix = `https://github.com/${repo}/releases/download/`;
	const expectedSuffix = `-${target}.zip`;
	for (const asset of assets) {
		if (!asset.name || !asset.browser_download_url) continue;
		if (
			asset.name.toLowerCase().endsWith(expectedSuffix.toLowerCase()) &&
			asset.browser_download_url.startsWith(expectedPrefix)
		) {
			return asset;
		}
	}
	return null;
}

/**
 * Queries GitHub Releases for the latest CertFlow portable release and compares it with this bundle.
 */
export async function checkForPortableUpdate(): Promise<PortableUpdateCheckResult> {
	const info = getPortableRuntimeInfo();
	if (!info.isPortable || !info.target) {
		throw new Error('Portable updates are only available in CertFlow Portable Edition.');
	}

	const apiUrl = `https://api.github.com/repos/${info.repo}/releases/latest`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);

	let release: GitHubReleasePayload;
	try {
		const res = await fetch(apiUrl, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': `CertFlow-Portable/${info.currentVersion}`
			},
			signal: controller.signal
		});
		if (!res.ok) {
			throw new Error(`GitHub returned HTTP ${res.status} while checking for updates.`);
		}
		release = (await res.json()) as GitHubReleasePayload;
	} finally {
		clearTimeout(timeout);
	}

	const latestVersion = (release.tag_name || '').trim();
	if (!latestVersion) {
		throw new Error('GitHub release response did not include a version tag.');
	}

	const asset = findMatchingReleaseAsset(release.assets, info.target, info.repo);
	const updateAvailable = compareSemver(latestVersion, info.currentVersion) > 0;

	return {
		currentVersion: info.currentVersion,
		latestVersion,
		updateAvailable,
		releaseUrl: release.html_url || `https://github.com/${info.repo}/releases/tag/${latestVersion}`,
		releaseNotes: (release.body ?? '').trim().slice(0, 1200),
		publishedAt: release.published_at ?? null,
		assetName: asset?.name ?? null,
		assetUrl: asset?.browser_download_url ?? null,
		assetSizeBytes: asset?.size ?? 0
	};
}

function locateExtractedBundleDir(extractRoot: string): string | null {
	if (existsSync(join(extractRoot, 'app', 'build', 'index.js'))) {
		return extractRoot;
	}
	for (const entry of readdirSync(extractRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const candidate = join(extractRoot, entry.name);
		if (existsSync(join(candidate, 'app', 'build', 'index.js'))) {
			return candidate;
		}
	}
	return null;
}

function writeWindowsUpdateScript(params: {
	scriptPath: string;
	rootDir: string;
	bundleDir: string;
	stagingDir: string;
	pid: number;
	port: string;
}) {
	const { scriptPath, rootDir, bundleDir, stagingDir, pid, port } = params;
	const lines = [
		'@echo off',
		'setlocal',
		`set "ROOT=${rootDir}"`,
		`set "NEWBUNDLE=${bundleDir}"`,
		`set "STAGING=${stagingDir}"`,
		`set "OLDPID=${pid}"`,
		`set "CERTFLOW_PORT=${port}"`,
		'',
		'echo Waiting for CertFlow to close before applying update...',
		'for /L %%I in (1,1,40) do (',
		'    tasklist /FI "PID eq %OLDPID%" 2>NUL | find /I "%OLDPID%" >NUL',
		'    if errorlevel 1 goto :pid_exited',
		'    timeout /t 1 /nobreak >NUL',
		')',
		':pid_exited',
		'timeout /t 1 /nobreak >NUL',
		'',
		'if exist "%ROOT%\\app.bak" rmdir /s /q "%ROOT%\\app.bak"',
		'if exist "%ROOT%\\runtime.bak" rmdir /s /q "%ROOT%\\runtime.bak"',
		'',
		'if exist "%ROOT%\\app" move /Y "%ROOT%\\app" "%ROOT%\\app.bak" >NUL',
		'move /Y "%NEWBUNDLE%\\app" "%ROOT%\\app" >NUL',
		'if errorlevel 1 (',
		'    if exist "%ROOT%\\app.bak" move /Y "%ROOT%\\app.bak" "%ROOT%\\app" >NUL',
		'    exit /b 1',
		')',
		'',
		'if exist "%NEWBUNDLE%\\runtime" (',
		'    if exist "%ROOT%\\runtime" move /Y "%ROOT%\\runtime" "%ROOT%\\runtime.bak" >NUL',
		'    move /Y "%NEWBUNDLE%\\runtime" "%ROOT%\\runtime" >NUL',
		'    if errorlevel 1 (',
		'        if exist "%ROOT%\\runtime.bak" move /Y "%ROOT%\\runtime.bak" "%ROOT%\\runtime" >NUL',
		'    )',
		')',
		'',
		'if exist "%NEWBUNDLE%\\Start-CertFlow.bat" copy /Y "%NEWBUNDLE%\\Start-CertFlow.bat" "%ROOT%\\Start-CertFlow.bat" >NUL',
		'if exist "%NEWBUNDLE%\\README-FIRST.txt" copy /Y "%NEWBUNDLE%\\README-FIRST.txt" "%ROOT%\\README-FIRST.txt" >NUL',
		'',
		'if exist "%ROOT%\\app.bak" rmdir /s /q "%ROOT%\\app.bak"',
		'if exist "%ROOT%\\runtime.bak" rmdir /s /q "%ROOT%\\runtime.bak"',
		'',
		'start "CertFlow" cmd /c "%ROOT%\\Start-CertFlow.bat"',
		'timeout /t 2 /nobreak >NUL',
		'rmdir /s /q "%STAGING%" 2>NUL',
		''
	];
	writeFileSync(scriptPath, lines.join('\r\n'), 'utf8');
}

function writeUnixUpdateScript(params: {
	scriptPath: string;
	rootDir: string;
	bundleDir: string;
	stagingDir: string;
	pid: number;
	port: string;
	target: PortableTarget;
}) {
	const { scriptPath, rootDir, bundleDir, stagingDir, pid, port, target } = params;
	const launcherName = target.startsWith('darwin') ? 'Start-CertFlow.command' : 'start-certflow.sh';
	const sq = (val: string) => `'${val.replace(/'/g, "'\\''")}'`;

	const lines = [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		`ROOT=${sq(rootDir)}`,
		`NEWBUNDLE=${sq(bundleDir)}`,
		`STAGING=${sq(stagingDir)}`,
		`OLDPID=${pid}`,
		`PORT=${sq(port)}`,
		`LAUNCHER=${sq(launcherName)}`,
		`TARGET=${sq(target)}`,
		'',
		'for _ in $(seq 1 40); do',
		'  if ! kill -0 "$OLDPID" 2>/dev/null; then',
		'    break',
		'  fi',
		'  sleep 0.5',
		'done',
		'sleep 0.5',
		'',
		'rm -rf "${ROOT}/app.bak" "${ROOT}/runtime.bak"',
		'if [ -d "${ROOT}/app" ]; then mv "${ROOT}/app" "${ROOT}/app.bak"; fi',
		'if ! mv "${NEWBUNDLE}/app" "${ROOT}/app"; then',
		'  if [ -d "${ROOT}/app.bak" ]; then mv "${ROOT}/app.bak" "${ROOT}/app"; fi',
		'  exit 1',
		'fi',
		'',
		'if [ -d "${NEWBUNDLE}/runtime" ]; then',
		'  if [ -d "${ROOT}/runtime" ]; then mv "${ROOT}/runtime" "${ROOT}/runtime.bak"; fi',
		'  if ! mv "${NEWBUNDLE}/runtime" "${ROOT}/runtime"; then',
		'    if [ -d "${ROOT}/runtime.bak" ]; then mv "${ROOT}/runtime.bak" "${ROOT}/runtime"; fi',
		'  fi',
		'  chmod +x "${ROOT}/runtime/bin/node" || true',
		'fi',
		'',
		'if [ -f "${NEWBUNDLE}/${LAUNCHER}" ]; then',
		'  cp -f "${NEWBUNDLE}/${LAUNCHER}" "${ROOT}/${LAUNCHER}"',
		'  chmod +x "${ROOT}/${LAUNCHER}" || true',
		'fi',
		'if [ -f "${NEWBUNDLE}/README-FIRST.txt" ]; then',
		'  cp -f "${NEWBUNDLE}/README-FIRST.txt" "${ROOT}/README-FIRST.txt"',
		'fi',
		'',
		'rm -rf "${ROOT}/app.bak" "${ROOT}/runtime.bak" "${STAGING}"',
		'',
		'export PORT',
		'export HOST="127.0.0.1"',
		'export ORIGIN="http://localhost:${PORT}"',
		'export NODE_ENV="production"',
		'export CERTFLOW_SELF_HOSTED="true"',
		'export CERTFLOW_PORTABLE="true"',
		'export CERTFLOW_PORTABLE_ROOT="${ROOT}"',
		'export CERTFLOW_PORTABLE_TARGET="${TARGET}"',
		'export CERTFLOW_DATA_DIR="${ROOT}/data"',
		'export LOCAL_UPLOAD_DIR="${ROOT}/data/uploads"',
		'export STORAGE_DRIVER="local"',
		'export CERTFLOW_APP_DIR="${ROOT}/app"',
		'cd "${ROOT}/app"',
		'nohup "${ROOT}/runtime/bin/node" "${ROOT}/app/scripts/start.mjs" >/dev/null 2>&1 &',
		''
	];
	writeFileSync(scriptPath, lines.join('\n'), 'utf8');
	chmodSync(scriptPath, 0o755);
}

/**
 * Downloads the latest verified GitHub Release ZIP for this portable platform, extracts it into
 * a staging folder, spawns a detached OS handoff script that replaces `app/`, `runtime/` and the
 * launcher (never touching `data/`), then gracefully shuts down so the updated version restarts.
 */
export async function downloadAndInstallPortableUpdate(): Promise<{
	status: 'restarting';
	version: string;
}> {
	if (updateInProgress) {
		throw new Error('An update is already being downloaded and installed.');
	}

	const info = getPortableRuntimeInfo();
	if (!info.isPortable || !info.target) {
		throw new Error('Portable updates are only available in CertFlow Portable Edition.');
	}

	updateInProgress = true;
	const stagingDir = join(info.rootDir, '.update-staging');
	const zipPath = join(stagingDir, 'update.zip');
	const extractDir = join(stagingDir, 'extracted');

	try {
		const check = await checkForPortableUpdate();
		if (!check.updateAvailable) {
			throw new Error(`CertFlow is already up to date (${check.currentVersion}).`);
		}
		if (!check.assetUrl) {
			throw new Error(
				`Release ${check.latestVersion} does not include a portable ZIP for ${info.target}.`
			);
		}

		const allowedPrefix = `https://github.com/${info.repo}/releases/download/`;
		if (!check.assetUrl.startsWith(allowedPrefix)) {
			throw new Error('Refusing to download update from an untrusted URL.');
		}

		rmSync(stagingDir, { recursive: true, force: true });
		mkdirSync(extractDir, { recursive: true });

		const res = await fetch(check.assetUrl, {
			headers: { 'User-Agent': `CertFlow-Portable/${info.currentVersion}` }
		});
		if (!res.ok) {
			throw new Error(`Could not download update archive (HTTP ${res.status}).`);
		}

		const zipBytes = new Uint8Array(await res.arrayBuffer());
		if (zipBytes.byteLength < 1024 * 1024) {
			throw new Error('Downloaded update archive looks incomplete.');
		}
		writeFileSync(zipPath, zipBytes);

		if (process.platform === 'win32') {
			execFileSync(
				'powershell',
				[
					'-NoProfile',
					'-Command',
					`Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
				],
				{ stdio: 'pipe' }
			);
		} else {
			execFileSync('unzip', ['-q', '-o', zipPath, '-d', extractDir], { stdio: 'pipe' });
		}

		const bundleDir = locateExtractedBundleDir(extractDir);
		if (!bundleDir || !existsSync(join(bundleDir, 'app', 'scripts', 'start.mjs'))) {
			throw new Error('Extracted archive is missing expected CertFlow application files.');
		}

		const port = process.env.PORT || '3000';

		if (process.platform === 'win32') {
			const scriptPath = join(stagingDir, 'apply-update.cmd');
			writeWindowsUpdateScript({
				scriptPath,
				rootDir: info.rootDir,
				bundleDir,
				stagingDir,
				pid: process.pid,
				port
			});
			const child = spawn('cmd.exe', ['/c', scriptPath], {
				detached: true,
				stdio: 'ignore',
				windowsHide: true
			});
			child.unref();
		} else {
			const scriptPath = join(stagingDir, 'apply-update.sh');
			writeUnixUpdateScript({
				scriptPath,
				rootDir: info.rootDir,
				bundleDir,
				stagingDir,
				pid: process.pid,
				port,
				target: info.target
			});
			const child = spawn('bash', [scriptPath], {
				detached: true,
				stdio: 'ignore'
			});
			child.unref();
		}

		// Close PGlite cleanly after the HTTP response flushes, then exit so the updater script swaps files.
		setTimeout(() => {
			void resetDatabaseConnection().finally(() => {
				process.exit(0);
			});
		}, 600).unref();

		return { status: 'restarting', version: check.latestVersion };
	} catch (err) {
		updateInProgress = false;
		rmSync(stagingDir, { recursive: true, force: true });
		throw err;
	}
}
