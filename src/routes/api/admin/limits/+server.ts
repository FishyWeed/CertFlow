import { error, json } from '@sveltejs/kit';
import {
	getQuotaSettingsSnapshot,
	isUserAdmin,
	quotaLimitsInputSchema,
	resetQuotaLimits,
	saveQuotaLimits
} from '#lib/server/app-settings.ts';
import type { RequestHandler } from './$types';

async function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Sign in required.');
	}
	const admin = await isUserAdmin(locals.user);
	if (!admin) {
		throw error(403, 'Administrator access is required.');
	}
	return locals.user;
}

export const GET: RequestHandler = async ({ locals }) => {
	await requireAdmin(locals);
	const snapshot = await getQuotaSettingsSnapshot();
	return json(snapshot);
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	const adminUser = await requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const parsed = quotaLimitsInputSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid quota limits.');
	}

	const snapshot = await saveQuotaLimits(parsed.data, adminUser.id);
	return json(snapshot);
};

export const DELETE: RequestHandler = async ({ locals }) => {
	await requireAdmin(locals);
	const snapshot = await resetQuotaLimits();
	return json(snapshot);
};
