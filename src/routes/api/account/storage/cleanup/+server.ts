import { error, json } from '@sveltejs/kit';
import { getUserAccountUsage, pruneUnusedUserAssets } from '#lib/server/asset-cleanup.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const result = await pruneUnusedUserAssets(locals.user.id);
	const usage = await getUserAccountUsage(locals.user.id);

	return json({
		deletedCount: result.deletedCount,
		freedBytes: result.freedBytes,
		usage
	});
};
