import { execFileSync } from 'node:child_process';
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const NODE_VERSION = getArg('--node-version') || '22.14.0';
const RELEASE_VERSION = getArg('--version') || `v${pkg.version || '1.0.0'}`;
const TARGET_ARG = getArg('--target') || 'all';
const OUT_DIR = resolve(ROOT, getArg('--out-dir') || 'release');
const NODE_MODULES_DIR = resolve(ROOT, getArg('--node-modules') || 'node_modules');
const CACHE_DIR = resolve(ROOT, '.tmp', 'portable-node-cache');
const STAGING_ROOT = resolve(ROOT, '.tmp', 'portable-staging');

const TARGETS = {
	'win-x64': {
		label: 'Windows (64-bit)',
		nodeArchive: `node-v${NODE_VERSION}-win-x64.zip`,
		archiveType: 'zip',
		nodeBinRel: `node-v${NODE_VERSION}-win-x64/node.exe`,
		destNodeRel: 'runtime/node.exe',
		launcherName: 'Start-CertFlow.bat',
		launcherMode: 0o644
	},
	'darwin-arm64': {
		label: 'macOS (Apple Silicon)',
		nodeArchive: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
		archiveType: 'tar.gz',
		nodeBinRel: `node-v${NODE_VERSION}-darwin-arm64/bin/node`,
		destNodeRel: 'runtime/bin/node',
		launcherName: 'Start-CertFlow.command',
		launcherMode: 0o755
	},
	'darwin-x64': {
		label: 'macOS (Intel)',
		nodeArchive: `node-v${NODE_VERSION}-darwin-x64.tar.gz`,
		archiveType: 'tar.gz',
		nodeBinRel: `node-v${NODE_VERSION}-darwin-x64/bin/node`,
		destNodeRel: 'runtime/bin/node',
		launcherName: 'Start-CertFlow.command',
		launcherMode: 0o755
	},
	'linux-x64': {
		label: 'Linux (64-bit)',
		nodeArchive: `node-v${NODE_VERSION}-linux-x64.tar.gz`,
		archiveType: 'tar.gz',
		nodeBinRel: `node-v${NODE_VERSION}-linux-x64/bin/node`,
		destNodeRel: 'runtime/bin/node',
		launcherName: 'start-certflow.sh',
		launcherMode: 0o755
	}
};

function getArg(flag) {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : '';
}

function buildWindowsLauncher() {
	return [
		'@echo off',
		'setlocal',
		'title CertFlow',
		'set "ROOT=%~dp0"',
		'set "PORT=3000"',
		'set "HOST=127.0.0.1"',
		'set "NODE_ENV=production"',
		'set "CERTFLOW_SELF_HOSTED=true"',
		'set "CERTFLOW_DATA_DIR=%ROOT%data"',
		'set "LOCAL_UPLOAD_DIR=%ROOT%data\\uploads"',
		'set "STORAGE_DRIVER=local"',
		'set "CERTFLOW_APP_DIR=%ROOT%app"',
		'',
		'echo ========================================',
		'echo   CertFlow Portable Edition',
		'echo ========================================',
		'echo.',
		'echo Starting CertFlow on http://localhost:%PORT% ...',
		'echo Keep this window open while using CertFlow.',
		'echo Close this window to stop CertFlow safely.',
		'echo.',
		'',
		'start "" /b powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(45); while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 \'http://127.0.0.1:3000/api/health\'; if ($r.StatusCode -eq 200) { Start-Process \'http://localhost:3000\'; break } } catch {}; Start-Sleep -Milliseconds 700 }"',
		'',
		'cd /d "%ROOT%app"',
		'"%ROOT%runtime\\node.exe" "%ROOT%app\\scripts\\start.mjs"',
		'',
		'echo.',
		'echo CertFlow has stopped.',
		'pause',
		''
	].join('\r\n');
}

function buildUnixLauncher(isMac) {
	const openCmd = isMac ? 'open "http://localhost:${PORT}"' : 'xdg-open "http://localhost:${PORT}"';
	return [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'',
		'ROOT="$(cd "$(dirname "$0")" && pwd)"',
		'export PORT="${CERTFLOW_PORT:-3000}"',
		'export HOST="127.0.0.1"',
		'export NODE_ENV="production"',
		'export CERTFLOW_SELF_HOSTED="true"',
		'export CERTFLOW_DATA_DIR="${ROOT}/data"',
		'export LOCAL_UPLOAD_DIR="${ROOT}/data/uploads"',
		'export STORAGE_DRIVER="local"',
		'export CERTFLOW_APP_DIR="${ROOT}/app"',
		'',
		'echo "========================================"',
		'echo "  CertFlow Portable Edition"',
		'echo "========================================"',
		'echo',
		'echo "Starting CertFlow on http://localhost:${PORT} ..."',
		'echo "Keep this window open while using CertFlow."',
		'echo "Press Ctrl+C or close this window to stop CertFlow safely."',
		'echo',
		'',
		'(',
		'  for _ in $(seq 1 60); do',
		'    if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then',
		`      ${openCmd} >/dev/null 2>&1 || true`,
		'      break',
		'    fi',
		'    sleep 0.7',
		'  done',
		') &',
		'',
		'cd "${ROOT}/app"',
		'exec "${ROOT}/runtime/bin/node" "${ROOT}/app/scripts/start.mjs"',
		''
	].join('\n');
}

function buildReadmeFirst(targetKey, launcherName) {
	const osNote =
		targetKey === 'win-x64'
			? 'Windows note: If Windows Defender SmartScreen appears on first launch, click "More info" then "Run anyway".'
			: targetKey.startsWith('darwin')
				? 'macOS note: If macOS warns about an unidentified developer on first launch, right-click Start-CertFlow.command and choose "Open".'
				: 'Linux note: Run ./start-certflow.sh from this folder (or double-click if your file manager runs shell scripts).';

	return [
		'CertFlow Portable Edition',
		'=========================',
		'',
		'No Docker, Node.js or database installation is required.',
		'',
		'How to start:',
		`1. Double-click ${launcherName} in this folder.`,
		'2. Your browser will open http://localhost:3000 automatically.',
		'3. On first launch, enter your name, email and password, then click "Start CertFlow".',
		'4. Keep the terminal window open while using CertFlow. Close it when finished.',
		'',
		'Where your data lives:',
		'- All settings, projects, database files and uploaded images are stored inside the "data" folder.',
		'- Back up the "data" folder to preserve your templates and recipients.',
		'',
		osNote,
		''
	].join('\n');
}

async function downloadNodeArchive(archiveName) {
	mkdirSync(CACHE_DIR, { recursive: true });
	const cachedPath = join(CACHE_DIR, archiveName);
	if (existsSync(cachedPath)) {
		return cachedPath;
	}
	const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`;
	console.log(`[portable] Downloading ${url} ...`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download ${url} (HTTP ${res.status})`);
	}
	const bytes = new Uint8Array(await res.arrayBuffer());
	writeFileSync(cachedPath, bytes);
	return cachedPath;
}

function extractNodeBinary(archivePath, archiveType, memberPath, destPath) {
	mkdirSync(resolve(destPath, '..'), { recursive: true });
	const tmpExtract = join(STAGING_ROOT, `_extract_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
	mkdirSync(tmpExtract, { recursive: true });

	try {
		if (archiveType === 'tar.gz') {
			execFileSync('tar', ['-xzf', archivePath, '-C', tmpExtract, memberPath], { stdio: 'inherit' });
		} else if (process.platform === 'win32') {
			execFileSync(
				'powershell',
				[
					'-NoProfile',
					'-Command',
					`Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${tmpExtract}' -Force`
				],
				{ stdio: 'inherit' }
			);
		} else {
			execFileSync('unzip', ['-q', archivePath, memberPath, '-d', tmpExtract], { stdio: 'inherit' });
		}

		const extracted = join(tmpExtract, memberPath);
		if (!existsSync(extracted)) {
			throw new Error(`Expected Node binary not found at ${extracted}`);
		}
		cpSync(extracted, destPath);
		if (!destPath.endsWith('.exe')) {
			chmodSync(destPath, 0o755);
		}
	} finally {
		rmSync(tmpExtract, { recursive: true, force: true });
	}
}

function createZipArchive(sourceParentDir, folderName, zipOutputPath) {
	rmSync(zipOutputPath, { force: true });
	if (process.platform === 'win32') {
		execFileSync(
			'powershell',
			[
				'-NoProfile',
				'-Command',
				`Compress-Archive -Path '${join(sourceParentDir, folderName)}' -DestinationPath '${zipOutputPath}' -CompressionLevel Optimal`
			],
			{ stdio: 'inherit' }
		);
	} else {
		execFileSync('zip', ['-r', '-q', '-y', zipOutputPath, folderName], {
			cwd: sourceParentDir,
			stdio: 'inherit'
		});
	}
}

async function buildTarget(targetKey) {
	const cfg = TARGETS[targetKey];
	if (!cfg) {
		throw new Error(`Unknown target "${targetKey}". Valid targets: ${Object.keys(TARGETS).join(', ')}`);
	}

	const bundleName = `CertFlow-${RELEASE_VERSION}-${targetKey}`;
	const bundleDir = join(STAGING_ROOT, bundleName);
	const appDir = join(bundleDir, 'app');

	rmSync(bundleDir, { recursive: true, force: true });
	mkdirSync(appDir, { recursive: true });
	mkdirSync(join(bundleDir, 'data', 'uploads'), { recursive: true });
	mkdirSync(join(bundleDir, 'data', 'pgdata'), { recursive: true });

	// Copy prebuilt SvelteKit app, Drizzle migrations, start script and production node_modules.
	cpSync(join(ROOT, 'build'), join(appDir, 'build'), { recursive: true });
	cpSync(join(ROOT, 'drizzle'), join(appDir, 'drizzle'), { recursive: true });
	cpSync(join(ROOT, 'scripts', 'start.mjs'), join(appDir, 'scripts', 'start.mjs'));
	cpSync(join(ROOT, 'package.json'), join(appDir, 'package.json'));
	cpSync(NODE_MODULES_DIR, join(appDir, 'node_modules'), {
		recursive: true
	});

	// Download and bundle only the single portable Node.js binary for this OS/arch.
	const archivePath = await downloadNodeArchive(cfg.nodeArchive);
	extractNodeBinary(archivePath, cfg.archiveType, cfg.nodeBinRel, join(bundleDir, cfg.destNodeRel));

	// Write double-click launcher and README-FIRST.txt.
	const launcherPath = join(bundleDir, cfg.launcherName);
	const launcherBody =
		targetKey === 'win-x64'
			? buildWindowsLauncher()
			: buildUnixLauncher(targetKey.startsWith('darwin'));
	writeFileSync(launcherPath, launcherBody, 'utf8');
	if (cfg.launcherMode === 0o755) {
		chmodSync(launcherPath, 0o755);
	}

	writeFileSync(join(bundleDir, 'README-FIRST.txt'), buildReadmeFirst(targetKey, cfg.launcherName), 'utf8');

	mkdirSync(OUT_DIR, { recursive: true });
	const zipPath = join(OUT_DIR, `${bundleName}.zip`);
	console.log(`[portable] Packing ${zipPath} ...`);
	createZipArchive(STAGING_ROOT, bundleName, zipPath);
	rmSync(bundleDir, { recursive: true, force: true });
	console.log(`[portable] Created ${zipPath}`);
}

async function main() {
	if (!existsSync(join(ROOT, 'build', 'index.js'))) {
		throw new Error('Missing build/index.js. Run `pnpm build` before packaging portable releases.');
	}

	const requested = TARGET_ARG === 'all' ? Object.keys(TARGETS) : [TARGET_ARG];
	mkdirSync(STAGING_ROOT, { recursive: true });

	for (const targetKey of requested) {
		await buildTarget(targetKey);
	}
	console.log('[portable] All portable bundles complete.');
}

await main();
