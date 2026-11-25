import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const failures = [];

function assert(condition, message) {
	if (!condition) failures.push(message);
}

function readText(relPath) {
	const full = join(ROOT, relPath);
	if (!existsSync(full)) {
		failures.push(`Missing required file: ${relPath}`);
		return '';
	}
	return readFileSync(full, 'utf8');
}

// 1. Validate Node script syntax and local HTTP ORIGIN guard
for (const scriptPath of ['scripts/start.mjs', 'scripts/package-portable.mjs']) {
	try {
		execFileSync(process.execPath, ['--check', join(ROOT, scriptPath)], { stdio: 'pipe' });
	} catch (err) {
		failures.push(`Syntax check failed for ${scriptPath}: ${err instanceof Error ? err.message : String(err)}`);
	}
}
const startScript = readText('scripts/start.mjs');
assert(
	startScript.includes('process.env.ORIGIN'),
	'scripts/start.mjs must set process.env.ORIGIN for direct local HTTP launches to prevent 403 CSRF errors.'
);

// 2. Validate Dockerfile compatibility across Railway, Render and Docker
const dockerfile = readText('Dockerfile');
assert(!/^\s*VOLUME\s+/m.test(dockerfile), 'Dockerfile must not declare VOLUME (unsupported by Railway).');
assert(dockerfile.includes('pnpm-workspace.yaml'), 'Dockerfile must copy pnpm-workspace.yaml before pnpm install.');
assert(dockerfile.includes('npm install -g pnpm@'), 'Dockerfile must install pnpm without corepack key failures.');
assert(!/^\s*PORT=3000/m.test(dockerfile), 'Dockerfile should not hardcode PORT=3000 so cloud hosts can inject PORT.');

// 3. Validate railway.json (Pipelines 2 & 3)
const railwayRaw = readText('railway.json');
if (railwayRaw) {
	try {
		const railway = JSON.parse(railwayRaw);
		assert(railway.build?.builder === 'DOCKERFILE', 'railway.json must specify DOCKERFILE builder.');
		assert(railway.deploy?.healthcheckPath === '/api/health', 'railway.json must set healthcheckPath to /api/health.');
	} catch (err) {
		failures.push(`Invalid JSON in railway.json: ${err instanceof Error ? err.message : String(err)}`);
	}
}

// 4. Validate render.yaml (Pipeline 4)
const renderYaml = readText('render.yaml');
assert(renderYaml.includes('dockerfilePath: ./Dockerfile'), 'render.yaml must reference ./Dockerfile.');
assert(renderYaml.includes('healthCheckPath: /api/health'), 'render.yaml must set healthCheckPath: /api/health.');
assert(renderYaml.includes('BETTER_AUTH_SECRET'), 'render.yaml must generate BETTER_AUTH_SECRET.');
assert(renderYaml.includes('ENCRYPTION_KEY'), 'render.yaml must generate ENCRYPTION_KEY.');

// 5. Validate Docker Compose stacks (Pipeline 5)
const composeLocal = readText('docker-compose.yml');
assert(composeLocal.includes('CERTFLOW_SELF_HOSTED'), 'docker-compose.yml must enable CERTFLOW_SELF_HOSTED.');
const composeGhcr = readText('docker-compose.ghcr.yml');
assert(composeGhcr.includes('ghcr.io/fishyweed/certflow:latest'), 'docker-compose.ghcr.yml must reference GHCR image.');

// 6. Validate GitHub Actions workflows (Pipelines 2, 5 & 6)
for (const wf of [
	'.github/workflows/ci.yml',
	'.github/workflows/docker-publish.yml',
	'.github/workflows/release-portable.yml'
]) {
	readText(wf);
}

if (failures.length > 0) {
	console.error('[verify-pipelines] Pipeline verification failed:');
	for (const msg of failures) console.error(`  - ${msg}`);
	process.exit(1);
}

console.log('[verify-pipelines] All 6 pipeline configurations and scripts passed.');
