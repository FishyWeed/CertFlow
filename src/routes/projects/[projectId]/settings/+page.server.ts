import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { projects } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import type { Actions } from './$types';

const updateProjectSchema = z.object({
	name: z.string().trim().min(2).max(120),
	defaultCertTitle: z.string().trim().max(180).default(''),
	description: z.string().trim().max(500).default('')
});

export const actions: Actions = {
	updateProject: async ({ params, request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const project = await requireOwnedProject(params.projectId, locals.user.id);

		const formData = await request.formData();
		const parsed = updateProjectSchema.safeParse({
			name: String(formData.get('name') ?? ''),
			defaultCertTitle: String(formData.get('defaultCertTitle') ?? ''),
			description: String(formData.get('description') ?? '')
		});

		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid project settings' });
		}

		await db
			.update(projects)
			.set({
				name: parsed.data.name,
				defaultCertTitle: parsed.data.defaultCertTitle || parsed.data.name,
				description: parsed.data.description || null,
				updatedAt: new Date()
			})
			.where(and(eq(projects.id, project.id), eq(projects.userId, locals.user.id)));

		return { saved: true };
	},

	deleteProject: async ({ params, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const project = await requireOwnedProject(params.projectId, locals.user.id);
		await db.delete(projects).where(eq(projects.id, project.id));
		throw redirect(302, '/dashboard');
	}
};
