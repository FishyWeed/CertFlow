import { error, json } from '@sveltejs/kit';
import {
	checkForPortableUpdate,
	getPortableRuntimeInfo,
	getPortableUpdateProgress,
	startPortableDownload,
	startPortableInstall
} from '#lib/server/portable-updater.ts';
import { isLocalAppRuntime } from '#lib/server/runtime-config.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Sign in required.');
	const portable = getPortableRuntimeInfo();
	const localAllowed = portable.isPortable || isLocalAppRuntime();
	if (!localAllowed) {
		throw error(404, 'App updates are only available on local CertFlow installations.');
	}

	if (url.searchParams.get('status') === '1') {
		return json(getPortableUpdateProgress());
	}

	try {
		const result = await checkForPortableUpdate({ allowNonPortable: !portable.isPortable });
		return json(result);
	} catch (err) {
		throw error(502, err instanceof Error ? err.message : 'Could not check GitHub for updates.');
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Sign in required.');
	if (!getPortableRuntimeInfo().isPortable) {
		throw error(
			404,
			'In-place download and install are only available in CertFlow Portable or Installed Desktop builds.'
		);
	}

	const body = (await request.json().catch(() => ({}))) as {
		action?: 'download' | 'install';
		autoInstall?: boolean;
	};

	try {
		if (body.action === 'install') {
			const progress = startPortableInstall();
			return json({ status: 'installing', progress }, { status: 202 });
		}
		const progress = startPortableDownload({ autoInstall: body.autoInstall === true });
		return json({ status: 'started', progress }, { status: 202 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Could not start update.';
		const statusCode = message.includes('No downloaded update') ? 400 : 500;
		throw error(statusCode, message);
	}
};
