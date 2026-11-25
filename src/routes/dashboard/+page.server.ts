import { randomUUID } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_CANVAS_PRESET } from '#lib/config/canvas.ts';
import { DEFAULT_CRITERIA } from '#lib/config/criteria.ts';
import { createDefaultEmailSettings } from '#lib/config/email.ts';
import { db } from '#lib/server/db/index.ts';
import { certificates, projects, recipients, templates } from '#lib/server/db/schema.ts';
import { createStarterTemplateState } from '#lib/templates/starter.ts';
import type { Actions, PageServerLoad } from './$types';

const createProjectSchema = z.object({
	name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(120),
	defaultCertTitle: z.string().trim().max(180).optional().default(''),
	description: z.string().trim().max(500).optional().default('')
});

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			defaultCertTitle: projects.defaultCertTitle,
			description: projects.description,
			updatedAt: projects.updatedAt,
			templateCount: sql<number>`(select count(*)::int from ${templates} where ${templates.projectId} = ${projects.id})`,
			recipientCount: sql<number>`(select count(*)::int from ${recipients} where ${recipients.projectId} = ${projects.id})`,
			certificateCount: sql<number>`(select count(*)::int from ${certificates} where ${certificates.projectId} = ${projects.id})`
		})
		.from(projects)
		.where(eq(projects.userId, locals.user.id))
		.orderBy(desc(projects.updatedAt));

	return {
		user: locals.user,
		projects: userProjects
	};
};

export const actions: Actions = {
	createProject: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const formData = await request.formData();
		const parsed = createProjectSchema.safeParse({
			name: String(formData.get('name') ?? ''),
			defaultCertTitle: String(formData.get('defaultCertTitle') ?? ''),
			description: String(formData.get('description') ?? '')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid project details.'
			});
		}

		const projectId = randomUUID();
		const certTitle = parsed.data.defaultCertTitle || parsed.data.name;

		await db.transaction(async (tx) => {
			await tx.insert(projects).values({
				id: projectId,
				userId: locals.user!.id,
				name: parsed.data.name,
				defaultCertTitle: certTitle,
				description: parsed.data.description || null,
				criteriaConfig: DEFAULT_CRITERIA,
				columnMapping: {},
				sourceHeaders: [],
				emailDefaults: createDefaultEmailSettings()
			});

			await tx.insert(templates).values({
				id: randomUUID(),
				projectId,
				name: 'Participant Certificate',
				assignedRoles: ['Participant'],
				rankingRule: { mode: 'any' },
				isDefault: true,
				width: DEFAULT_CANVAS_PRESET.width,
				height: DEFAULT_CANVAS_PRESET.height,
				canvasState: createStarterTemplateState(certTitle)
			});
		});

		return { success: true, projectId };
	}
};
