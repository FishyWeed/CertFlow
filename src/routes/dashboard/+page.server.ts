import { randomUUID } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_CANVAS_PRESET } from '#lib/config/canvas.ts';
import { DEFAULT_CRITERIA } from '#lib/config/criteria.ts';
import { createDefaultEmailSettings } from '#lib/config/email.ts';
import { MAX_PROJECTS_PER_USER } from '#lib/config/limits.ts';
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

	const baseProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			defaultCertTitle: projects.defaultCertTitle,
			description: projects.description,
			updatedAt: projects.updatedAt
		})
		.from(projects)
		.where(eq(projects.userId, locals.user.id))
		.orderBy(desc(projects.updatedAt));

	const projectIds = baseProjects.map((p) => p.id);
	const templateCounts = new Map<string, number>();
	const recipientCounts = new Map<string, number>();
	const certificateCounts = new Map<string, number>();

	if (projectIds.length > 0) {
		const [tplRows, recRows, certRows] = await Promise.all([
			db
				.select({ projectId: templates.projectId, total: count() })
				.from(templates)
				.where(inArray(templates.projectId, projectIds))
				.groupBy(templates.projectId),
			db
				.select({ projectId: recipients.projectId, total: count() })
				.from(recipients)
				.where(inArray(recipients.projectId, projectIds))
				.groupBy(recipients.projectId),
			db
				.select({ projectId: certificates.projectId, total: count() })
				.from(certificates)
				.where(inArray(certificates.projectId, projectIds))
				.groupBy(certificates.projectId)
		]);

		for (const row of tplRows) templateCounts.set(row.projectId, Number(row.total));
		for (const row of recRows) recipientCounts.set(row.projectId, Number(row.total));
		for (const row of certRows) certificateCounts.set(row.projectId, Number(row.total));
	}

	const userProjects = baseProjects.map((p) => ({
		...p,
		templateCount: templateCounts.get(p.id) ?? 0,
		recipientCount: recipientCounts.get(p.id) ?? 0,
		certificateCount: certificateCounts.get(p.id) ?? 0
	}));

	return {
		user: locals.user,
		projects: userProjects,
		limits: {
			maxProjects: MAX_PROJECTS_PER_USER
		}
	};
};

export const actions: Actions = {
	createProject: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const [existingCountRow] = await db
			.select({ total: count() })
			.from(projects)
			.where(eq(projects.userId, locals.user.id));

		if (Number(existingCountRow?.total ?? 0) >= MAX_PROJECTS_PER_USER) {
			return fail(400, {
				error: `You have reached the limit of ${MAX_PROJECTS_PER_USER} projects per account. Delete an older project to create a new one.`
			});
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
				name: 'Certificate Template',
				assignedRoles: [],
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
