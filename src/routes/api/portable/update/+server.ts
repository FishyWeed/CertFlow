import { error, json } from '@sveltejs/kit';
import {
	checkForPortableUpdate,
	downloadAndInstallPortableUpdate,
	getPortableRuntimeInfo
} from '#lib/server/portable-updater.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Sign in required.');
	if (!getPortableRuntimeInfo().isPortable) {
		throw error(404, 'Portable updates are only available in CertFlow Portable Edition.');
	}

	try {
		const result = await checkForPortableUpdate();
		return json(result);
	} catch (err) {
		throw error(502, err instanceof Error ? err.message : 'Could not check GitHub for updates.');
	}
};

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Sign in required.');
	if (!getPortableRuntimeInfo().isPortable) {
		throw error(404, 'Portable updates are only available in CertFlow Portable Edition.');
	}

	try {
		const result = await downloadAndInstallPortableUpdate();
		return json(result);
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Could not install update.');
	}
};
