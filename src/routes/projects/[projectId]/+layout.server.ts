import { redirect } from '@sveltejs/kit';
import { loadProjectWorkspace } from '#lib/server/projects.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const workspace = await loadProjectWorkspace(params.projectId, locals.user.id);
	return {
		user: locals.user,
		...workspace
	};
};
