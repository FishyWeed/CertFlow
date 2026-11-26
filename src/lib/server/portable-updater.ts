import { spawn } from 'node:child_process';
import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
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
	stagedVersion: string | null;
}

export type PortableUpdateStage =
	| 'idle'
	| 'checking'
	| 'downloading'
	| 'extracting'
	| 'downloaded'
	| 'applying'
	| 'restarting'
	| 'error';

export interface PortableUpdateProgress {
	stage: PortableUpdateStage;
	version: string;
	stagedVersion: string | null;
	downloadedBytes: number;
	totalBytes: number;
	percent: number | null;
	message: string;
	error: string | null;
}

export interface StagedPortableUpdate {
	version: string;
	bundleDir: string;
	downloadedAt: string;
}

const DEFAULT_REPO = 'FishyWeed/CertFlow';
const VALID_TARGETS = new Set<PortableTarget>(['win-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64']);
let updateInProgress = false;
let updateProgress: PortableUpdateProgress = {
	stage: 'idle',
	version: '',
	stagedVersion: null,
	downloadedBytes: 0,
	totalBytes: 0,
	percent: null,
	message: '',
	error: null
};

export function clearStagedPortableUpdate(
	info: PortableRuntimeInfo = getPortableRuntimeInfo()
): void {
	if (updateInProgress || !info.isPortable || !info.rootDir) return;
	const stagingRoot = resolve(join(info.rootDir, '.update-staging'));
	if (existsSync(stagingRoot)) {
		try {
			rmSync(stagingRoot, { recursive: true, force: true });
		} catch {
			// Ignore transient Windows file locks; next check will retry cleanup.
		}
	}
	if (updateProgress.stagedVersion !== null || updateProgress.stage === 'downloaded') {
		updateProgress = {
			...updateProgress,
			stage: updateProgress.stage === 'downloaded' ? 'idle' : updateProgress.stage,
			stagedVersion: null
		};
	}
}

export function getStagedPortableUpdate(
	info: PortableRuntimeInfo = getPortableRuntimeInfo()
): StagedPortableUpdate | null {
	if (!info.isPortable || !info.rootDir) return null;
	const stagingRoot = resolve(join(info.rootDir, '.update-staging'));
	const manifestPath = join(stagingRoot, 'staged-update.json');
	if (!existsSync(manifestPath)) {
		// Remove leftover/incomplete local download folders when no active download is running.
		if (!updateInProgress && existsSync(stagingRoot)) {
			clearStagedPortableUpdate(info);
		}
		return null;
	}
	try {
		const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as Partial<StagedPortableUpdate>;
		if (
			typeof parsed.version !== 'string' ||
			!parsed.version.trim() ||
			typeof parsed.bundleDir !== 'string' ||
			!parsed.bundleDir.trim()
		) {
			clearStagedPortableUpdate(info);
			return null;
		}
		const version = parsed.version.trim();
		const resolvedBundle = resolve(parsed.bundleDir);
		if (!resolvedBundle.startsWith(stagingRoot)) {
			clearStagedPortableUpdate(info);
			return null;
		}
		if (!existsSync(join(resolvedBundle, 'app', 'scripts', 'start.mjs'))) {
			clearStagedPortableUpdate(info);
			return null;
		}
		// Already running this version or newer -> remove stale local download immediately.
		if (info.currentVersion && compareSemver(version, info.currentVersion) <= 0) {
			clearStagedPortableUpdate(info);
			return null;
		}
		return {
			version,
			bundleDir: resolvedBundle,
			downloadedAt: typeof parsed.downloadedAt === 'string' ? parsed.downloadedAt : ''
		};
	} catch {
		clearStagedPortableUpdate(info);
		return null;
	}
}

export function getPortableUpdateProgress(): PortableUpdateProgress {
	const staged = getStagedPortableUpdate();
	return {
		...updateProgress,
		stagedVersion: staged?.version ?? null
	};
}

function setProgress(patch: Partial<PortableUpdateProgress>) {
	updateProgress = { ...updateProgress, ...patch };
}

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

function detectHostTarget(): PortableTarget | '' {
	if (process.platform === 'win32' && process.arch === 'x64') return 'win-x64';
	if (process.platform === 'darwin' && process.arch === 'arm64') return 'darwin-arm64';
	if (process.platform === 'darwin' && process.arch === 'x64') return 'darwin-x64';
	if (process.platform === 'linux' && process.arch === 'x64') return 'linux-x64';
	return '';
}

/**
 * Queries GitHub Releases for the latest CertFlow portable release and compares it with this runtime.
 */
export async function checkForPortableUpdate(options?: {
	allowNonPortable?: boolean;
}): Promise<PortableUpdateCheckResult> {
	const info = getPortableRuntimeInfo();
	const allowNonPortable = options?.allowNonPortable === true && !isManagedCloud();
	if ((!info.isPortable || !info.target) && !allowNonPortable) {
		throw new Error('Portable updates are only available in CertFlow Portable Edition.');
	}

	const repo = info.repo || DEFAULT_REPO;
	const target = info.target || detectHostTarget();
	const currentVersion = info.currentVersion || process.env.CERTFLOW_VERSION?.trim() || 'v0.0.0-dev';

	const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);

	let release: GitHubReleasePayload;
	try {
		const res = await fetch(apiUrl, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': `CertFlow-Portable/${currentVersion}`
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

	const asset = target ? findMatchingReleaseAsset(release.assets, target, repo) : null;
	const updateAvailable = info.isPortable ? compareSemver(latestVersion, currentVersion) > 0 : true;
	if (info.isPortable && !updateAvailable) {
		clearStagedPortableUpdate(info);
	}
	const staged = info.isPortable && updateAvailable ? getStagedPortableUpdate(info) : null;

	return {
		currentVersion,
		latestVersion,
		updateAvailable,
		releaseUrl: release.html_url || `https://github.com/${repo}/releases/tag/${latestVersion}`,
		releaseNotes: (release.body ?? '').trim().slice(0, 1200),
		publishedAt: release.published_at ?? null,
		assetName: asset?.name ?? null,
		assetUrl: asset?.browser_download_url ?? null,
		assetSizeBytes: asset?.size ?? 0,
		stagedVersion: staged?.version ?? null
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

const UPDATE_RESTART_EXIT_CODE = 75;

export function buildWindowsVbsLauncherContent(scriptPath: string): string {
	const psExe = existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
		? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
		: 'powershell.exe';
	const cmd = `"${psExe}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${scriptPath}"`;
	const escaped = cmd.replace(/"/g, '""');
	return `CreateObject("WScript.Shell").Run "${escaped}", 0, False\r\n`;
}

export function buildWindowsUpdateScriptContent(params: {
	rootDir: string;
	bundleDir: string;
	stagingDir: string;
	pid: number;
	port: string;
}): string {
	const psQuote = (val: string) => `'${val.replace(/'/g, "''")}'`;
	const { rootDir, bundleDir, stagingDir, pid, port } = params;

	return [
		'$ErrorActionPreference = "Stop"',
		'$ProgressPreference = "SilentlyContinue"',
		`$Root = ${psQuote(rootDir)}`,
		`$NewBundle = ${psQuote(bundleDir)}`,
		`$Staging = ${psQuote(stagingDir)}`,
		`$OldPid = ${pid}`,
		`$Port = ${psQuote(port)}`,
		'$LogFile = Join-Path (Join-Path $Root "data") "last-update.log"',
		'',
		'function Write-Log([string]$msg) {',
		'    try {',
		'        $ts = (Get-Date).ToString("s")',
		'        Add-Content -LiteralPath $LogFile -Value "[$ts] $msg" -Encoding UTF8',
		'    } catch {}',
		'}',
		'',
		'function Move-WithRetry([string]$Source, [string]$Dest) {',
		'    for ($i = 0; $i -lt 25; $i++) {',
		'        try {',
		'            Move-Item -LiteralPath $Source -Destination $Dest -Force',
		'            return',
		'        } catch {',
		'            if ($i -eq 24) { throw }',
		'            Start-Sleep -Milliseconds 400',
		'        }',
		'    }',
		'}',
		'',
		'function Copy-WithRetry([string]$Source, [string]$Dest) {',
		'    for ($i = 0; $i -lt 25; $i++) {',
		'        try {',
		'            Copy-Item -LiteralPath $Source -Destination $Dest -Force',
		'            return',
		'        } catch {',
		'            if ($i -eq 24) { throw }',
		'            Start-Sleep -Milliseconds 300',
		'        }',
		'    }',
		'}',
		'',
		'function Remove-Quiet([string]$PathToRemove) {',
		'    if (-not (Test-Path -LiteralPath $PathToRemove)) { return }',
		'    for ($i = 0; $i -lt 8; $i++) {',
		'        try {',
		'            Remove-Item -LiteralPath $PathToRemove -Recurse -Force -ErrorAction Stop',
		'            return',
		'        } catch {',
		'            Start-Sleep -Milliseconds 300',
		'        }',
		'    }',
		'}',
		'',
		'Write-Log "Updater started (script PID $PID, waiting for server PID $OldPid)..."',
		'try {',
		'    Set-Location -LiteralPath $Root',
		'    $deadline = (Get-Date).AddSeconds(15)',
		'    while ((Get-Date) -lt $deadline) {',
		'        if (-not (Get-Process -Id $OldPid -ErrorAction SilentlyContinue)) { break }',
		'        Start-Sleep -Milliseconds 300',
		'    }',
		'    if (Get-Process -Id $OldPid -ErrorAction SilentlyContinue) {',
		'        Write-Log "PID $OldPid still alive after timeout; terminating..."',
		'        Stop-Process -Id $OldPid -Force -ErrorAction SilentlyContinue',
		'        Start-Sleep -Milliseconds 600',
		'    }',
		'',
		'    # Wait briefly for CertFlow.exe tray wrapper (if running from this folder) to exit cleanly.',
		'    $TrayExe = Join-Path $Root "CertFlow.exe"',
		'    $trayDeadline = (Get-Date).AddSeconds(6)',
		'    while ((Get-Date) -lt $trayDeadline) {',
		'        $trayProcs = @(Get-Process -Name "CertFlow" -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $TrayExe })',
		'        if ($trayProcs.Count -eq 0) { break }',
		'        Start-Sleep -Milliseconds 250',
		'    }',
		'    Start-Sleep -Milliseconds 400',
		'',
		'    $AppDir = Join-Path $Root "app"',
		'    $AppBak = Join-Path $Root "app.bak"',
		'    $NewApp = Join-Path $NewBundle "app"',
		'    $RuntimeDir = Join-Path $Root "runtime"',
		'    $RuntimeBak = Join-Path $Root "runtime.bak"',
		'    $NewRuntime = Join-Path $NewBundle "runtime"',
		'',
		'    Remove-Quiet $AppBak',
		'    Remove-Quiet $RuntimeBak',
		'',
		'    Write-Log "Swapping app folder..."',
		'    if (Test-Path -LiteralPath $AppDir) { Move-WithRetry $AppDir $AppBak }',
		'    try {',
		'        Move-WithRetry $NewApp $AppDir',
		'    } catch {',
		'        Write-Log "Failed to move new app folder; rolling back: $_"',
		'        if (Test-Path -LiteralPath $AppBak) { Move-WithRetry $AppBak $AppDir }',
		'        throw',
		'    }',
		'',
		'    if (Test-Path -LiteralPath $NewRuntime) {',
		'        Write-Log "Swapping runtime folder..."',
		'        try {',
		'            if (Test-Path -LiteralPath $RuntimeDir) { Move-WithRetry $RuntimeDir $RuntimeBak }',
		'            Move-WithRetry $NewRuntime $RuntimeDir',
		'        } catch {',
		'            Write-Log "Runtime swap skipped/rolled back: $_"',
		'            if ((Test-Path -LiteralPath $RuntimeBak) -and -not (Test-Path -LiteralPath $RuntimeDir)) {',
		'                Move-WithRetry $RuntimeBak $RuntimeDir',
		'            }',
		'        }',
		'    }',
		'',
		'    foreach ($file in @("CertFlow.exe", "Start-CertFlow.bat", "Create-Desktop-Shortcut.bat", "README-FIRST.txt", "certflow.ico")) {',
		'        $srcFile = Join-Path $NewBundle $file',
		'        if (Test-Path -LiteralPath $srcFile) {',
		'            try {',
		'                Copy-WithRetry $srcFile (Join-Path $Root $file)',
		'            } catch {',
		'                Write-Log "Could not update $file (continuing): $_"',
		'            }',
		'        }',
		'    }',
		'',
		'    Remove-Quiet $AppBak',
		'    Remove-Quiet $RuntimeBak',
		'',
		'    # Refresh Desktop, Start Menu and Windows shell icon cache so new app logos appear immediately.',
		'    try {',
		'        $IcoPath = Join-Path $Root "certflow.ico"',
		'        if (Test-Path -LiteralPath $IcoPath) {',
		'            $Wsh = New-Object -ComObject WScript.Shell',
		'            $ShortcutPaths = @(',
		'                (Join-Path ([Environment]::GetFolderPath("Desktop")) "CertFlow.lnk"),',
		'                (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\CertFlow\\CertFlow.lnk"),',
		'                (Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\CertFlow.lnk")',
		'            )',
		'            foreach ($lnk in $ShortcutPaths) {',
		'                if (Test-Path -LiteralPath $lnk) {',
		'                    $sc = $Wsh.CreateShortcut($lnk)',
		'                    if ($sc.TargetPath -and ($sc.TargetPath -like "$Root*")) {',
		'                        $sc.IconLocation = "$IcoPath,0"',
		'                        $sc.Save()',
		'                        Write-Log "Updated shortcut icon: $lnk"',
		'                    }',
		'                }',
		'            }',
		'            Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class CertFlowShell { [DllImport("shell32.dll")] public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2); }\' -ErrorAction SilentlyContinue',
		'            [CertFlowShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)',
		'            $ie4uinit = Join-Path $env:WINDIR "System32\\ie4uinit.exe"',
		'            if (Test-Path -LiteralPath $ie4uinit) {',
		'                Start-Process -FilePath $ie4uinit -ArgumentList @("-show") -WindowStyle Hidden -ErrorAction SilentlyContinue',
		'            }',
		'            Write-Log "Refreshed Windows shell icon cache."',
		'        }',
		'    } catch {',
		'        Write-Log "Shortcut/icon refresh skipped: $_"',
		'    }',
		'',
		'    $env:CERTFLOW_PORT = $Port',
		'    $BatLauncher = Join-Path $Root "Start-CertFlow.bat"',
		'    if (Test-Path -LiteralPath $TrayExe) {',
		'        Write-Log "Starting updated CertFlow silently via $TrayExe --no-open..."',
		'        Start-Process -FilePath $TrayExe -ArgumentList @("--no-open") -WorkingDirectory $Root',
		'    } else {',
		'        Write-Log "Starting updated CertFlow via $BatLauncher..."',
		'        Start-Process -FilePath $BatLauncher -WorkingDirectory $Root',
		'    }',
		'    Start-Sleep -Seconds 2',
		'    Remove-Quiet $Staging',
		'    Write-Log "Update completed cleanly."',
		'} catch {',
		'    Write-Log "Update failed: $_"',
		'    exit 1',
		'}',
		''
	].join('\r\n');
}

function writeWindowsUpdateScript(params: {
	scriptPath: string;
	rootDir: string;
	bundleDir: string;
	stagingDir: string;
	pid: number;
	port: string;
}) {
	writeFileSync(params.scriptPath, buildWindowsUpdateScriptContent(params), 'utf8');
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

function spawnAsync(command: string, args: string[]): Promise<void> {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true
		});
		let stderr = '';
		child.stderr?.on('data', (chunk: Buffer | string) => {
			if (stderr.length < 2000) stderr += chunk.toString();
		});
		child.on('error', (err) => rejectPromise(err));
		child.on('close', (code) => {
			if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(new Error(stderr.trim() || `${command} exited with code ${code}`));
			}
		});
	});
}

/**
 * Extracts a ZIP archive asynchronously without blocking the Node event loop.
 * On Windows, prefers native `tar.exe` (bsdtar, ~10-30x faster than PowerShell Expand-Archive)
 * and falls back to .NET `System.IO.Compression.ZipFile`.
 */
export async function extractZipArchive(zipPath: string, extractDir: string): Promise<void> {
	rmSync(extractDir, { recursive: true, force: true });
	mkdirSync(extractDir, { recursive: true });

	if (process.platform === 'win32') {
		try {
			await spawnAsync('tar.exe', ['-xf', zipPath, '-C', extractDir]);
			return;
		} catch {
			// Fall back to .NET ZipFile (much faster than Expand-Archive, works on all Windows builds).
			rmSync(extractDir, { recursive: true, force: true });
			const safeZip = zipPath.replace(/'/g, "''");
			const safeDest = extractDir.replace(/'/g, "''");
			await spawnAsync('powershell', [
				'-NoProfile',
				'-Command',
				`$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${safeZip}', '${safeDest}')`
			]);
			return;
		}
	}

	await spawnAsync('unzip', ['-q', '-o', zipPath, '-d', extractDir]);
}

async function streamDownloadToFile(
	url: string,
	destPath: string,
	userAgent: string,
	fallbackTotalBytes: number,
	onProgress: (downloadedBytes: number, totalBytes: number) => void
): Promise<number> {
	const res = await fetch(url, {
		headers: { 'User-Agent': userAgent }
	});
	if (!res.ok) {
		throw new Error(`Could not download update archive (HTTP ${res.status}).`);
	}

	const contentLengthHeader = Number(res.headers.get('content-length') || 0);
	const totalBytes =
		Number.isFinite(contentLengthHeader) && contentLengthHeader > 0
			? contentLengthHeader
			: fallbackTotalBytes;

	if (!res.body) {
		const bytes = new Uint8Array(await res.arrayBuffer());
		writeFileSync(destPath, bytes);
		onProgress(bytes.byteLength, Math.max(totalBytes, bytes.byteLength));
		return bytes.byteLength;
	}

	const writer = createWriteStream(destPath);
	const reader = res.body.getReader();
	let downloaded = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value || value.byteLength === 0) continue;
			downloaded += value.byteLength;
			if (!writer.write(value)) {
				await new Promise<void>((resDrain) => writer.once('drain', resDrain));
			}
			onProgress(downloaded, totalBytes);
		}
	} finally {
		await new Promise<void>((resEnd, rejEnd) => {
			writer.on('error', rejEnd);
			writer.end(() => resEnd());
		});
	}

	return statSync(destPath).size;
}

function launchStagedInstallHandoff(info: PortableRuntimeInfo, staged: StagedPortableUpdate): void {
	const stagingDir = join(info.rootDir, '.update-staging');
	setProgress({
		stage: 'applying',
		version: staged.version,
		stagedVersion: staged.version,
		percent: null,
		message: `Preparing ${staged.version} handoff...`,
		error: null
	});

	const port = process.env.PORT || '3000';

	if (process.platform === 'win32') {
		const scriptPath = join(stagingDir, 'apply-update.ps1');
		const vbsPath = join(stagingDir, 'launch-update.vbs');
		writeWindowsUpdateScript({
			scriptPath,
			rootDir: info.rootDir,
			bundleDir: staged.bundleDir,
			stagingDir,
			pid: process.pid,
			port
		});
		writeFileSync(vbsPath, buildWindowsVbsLauncherContent(scriptPath), 'utf8');

		// Note: Spawning powershell.exe directly from Node with `detached: true` + `windowsHide: true`
		// causes Windows PowerShell 5.1 to exit immediately (code 0) without running `-File`.
		// Launching through GUI-subsystem `wscript.exe` avoids console inheritance and runs hidden cleanly.
		const wscriptExe = existsSync('C:\\Windows\\System32\\wscript.exe')
			? 'C:\\Windows\\System32\\wscript.exe'
			: 'wscript.exe';
		const child = spawn(wscriptExe, ['//B', '//NoLogo', vbsPath], {
			cwd: info.rootDir,
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
			bundleDir: staged.bundleDir,
			stagingDir,
			pid: process.pid,
			port,
			target: info.target as PortableTarget
		});
		const child = spawn('bash', [scriptPath], {
			cwd: info.rootDir,
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
	}

	setProgress({
		stage: 'restarting',
		version: staged.version,
		stagedVersion: staged.version,
		percent: 100,
		message: `Installing ${staged.version} and restarting CertFlow... This page will reload automatically.`,
		error: null
	});

	// Give the browser poll a moment to receive `restarting`, close PGlite with a hard 4s cap,
	// then exit with UPDATE_RESTART_EXIT_CODE so launchers close cleanly without pausing.
	setTimeout(() => {
		void Promise.race([
			resetDatabaseConnection().catch(() => {}),
			new Promise<void>((resolveCap) => setTimeout(resolveCap, 4000))
		]).finally(() => {
			process.exit(UPDATE_RESTART_EXIT_CODE);
		});
	}, 900).unref();
}

async function runPortableDownloadPipeline(
	info: PortableRuntimeInfo,
	autoInstall: boolean
): Promise<void> {
	const stagingDir = join(info.rootDir, '.update-staging');
	const zipPath = join(stagingDir, 'update.zip');
	const extractDir = join(stagingDir, 'extracted');
	const manifestPath = join(stagingDir, 'staged-update.json');

	try {
		setProgress({
			stage: 'checking',
			version: '',
			downloadedBytes: 0,
			totalBytes: 0,
			percent: null,
			message: 'Checking latest release on GitHub...',
			error: null
		});

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
		mkdirSync(stagingDir, { recursive: true });

		setProgress({
			stage: 'downloading',
			version: check.latestVersion,
			stagedVersion: null,
			downloadedBytes: 0,
			totalBytes: check.assetSizeBytes,
			percent: 0,
			message: `Downloading ${check.latestVersion} from GitHub...`
		});

		const writtenBytes = await streamDownloadToFile(
			check.assetUrl,
			zipPath,
			`CertFlow-Portable/${info.currentVersion}`,
			check.assetSizeBytes,
			(downloaded, total) => {
				const percent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;
				setProgress({
					stage: 'downloading',
					downloadedBytes: downloaded,
					totalBytes: total,
					percent,
					message:
						percent !== null
							? `Downloading ${check.latestVersion} (${percent}%)...`
							: `Downloading ${check.latestVersion}...`
				});
			}
		);

		if (writtenBytes < 1024 * 1024) {
			throw new Error('Downloaded update archive looks incomplete.');
		}

		setProgress({
			stage: 'extracting',
			percent: null,
			message: `Extracting ${check.latestVersion} files...`
		});

		await extractZipArchive(zipPath, extractDir);

		const bundleDir = locateExtractedBundleDir(extractDir);
		if (!bundleDir || !existsSync(join(bundleDir, 'app', 'scripts', 'start.mjs'))) {
			throw new Error('Extracted archive is missing expected CertFlow application files.');
		}

		const staged: StagedPortableUpdate = {
			version: check.latestVersion,
			bundleDir,
			downloadedAt: new Date().toISOString()
		};
		writeFileSync(manifestPath, JSON.stringify(staged, null, 2), 'utf8');

		if (autoInstall) {
			launchStagedInstallHandoff(info, staged);
			return;
		}

		updateInProgress = false;
		setProgress({
			stage: 'downloaded',
			version: staged.version,
			stagedVersion: staged.version,
			percent: 100,
			message: `Downloaded ${staged.version}. Click Install to apply and restart CertFlow.`,
			error: null
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not download update.';
		updateInProgress = false;
		rmSync(stagingDir, { recursive: true, force: true });
		setProgress({
			stage: 'error',
			stagedVersion: null,
			percent: null,
			message,
			error: message
		});
	}
}

/**
 * Starts a non-blocking update download (and optional automatic install) in the background.
 */
export function startPortableDownload(options?: { autoInstall?: boolean }): PortableUpdateProgress {
	const info = getPortableRuntimeInfo();
	if (!info.isPortable || !info.target) {
		throw new Error('Portable updates are only available in CertFlow Portable Edition.');
	}

	if (updateInProgress) {
		return getPortableUpdateProgress();
	}

	const autoInstall = options?.autoInstall === true;
	updateInProgress = true;
	setProgress({
		stage: 'checking',
		version: '',
		downloadedBytes: 0,
		totalBytes: 0,
		percent: null,
		message: 'Checking latest release on GitHub...',
		error: null
	});

	void runPortableDownloadPipeline(info, autoInstall);
	return getPortableUpdateProgress();
}

/**
 * Installs a previously downloaded and staged update and restarts CertFlow.
 */
export function startPortableInstall(): PortableUpdateProgress {
	const info = getPortableRuntimeInfo();
	if (!info.isPortable || !info.target) {
		throw new Error('Portable updates are only available in CertFlow Portable Edition.');
	}

	if (updateInProgress) {
		return getPortableUpdateProgress();
	}

	const staged = getStagedPortableUpdate(info);
	if (!staged) {
		throw new Error('No downloaded update is ready to install. Download an update first.');
	}

	updateInProgress = true;
	try {
		launchStagedInstallHandoff(info, staged);
		return getPortableUpdateProgress();
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not start update install.';
		updateInProgress = false;
		setProgress({
			stage: 'error',
			percent: null,
			message,
			error: message
		});
		throw err;
	}
}

/**
 * Starts the non-blocking portable update job (download + automatic install).
 */
export function startPortableUpdate(): PortableUpdateProgress {
	return startPortableDownload({ autoInstall: true });
}
