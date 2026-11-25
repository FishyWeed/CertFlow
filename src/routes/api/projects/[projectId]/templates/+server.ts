import { randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { DEFAULT_CANVAS_PRESET } from '#lib/config/canvas.ts';
import { db } from '#lib/server/db/index.ts';
import { templates } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import { createStarterTemplateState } from '#lib/templates/starter.ts';
import type { RequestHandler } from './$types';

const createTemplateSchema = z.object({
	name: z.string().trim().min(1).max(120),
	assignedRoles: z.array(z.string().trim().min(1)).default([]),
	rankingRule: z
		.object({
			mode: z.enum(['any', 'has_ranking', 'no_ranking', 'specific_rankings']),
			values: z.array(z.string().trim().min(1)).optional(),
			propertyFilters: z.record(z.string(), z.array(z.string().trim())).optional()
		})
		.default({ mode: 'any' })
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = createTemplateSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid template payload');
	}

	const id = randomUUID();
	const [created] = await db
		.insert(templates)
		.values({
			id,
			projectId: project.id,
			name: parsed.data.name,
			assignedRoles: parsed.data.assignedRoles,
			rankingRule: parsed.data.rankingRule,
			isDefault: false,
			width: DEFAULT_CANVAS_PRESET.width,
			height: DEFAULT_CANVAS_PRESET.height,
			canvasState: createStarterTemplateState(project.defaultCertTitle || project.name)
		})
		.returning();

	return json({ template: created }, { status: 201 });
};
