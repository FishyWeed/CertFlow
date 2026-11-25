import { error, json } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { pruneUnusedProjectAssets } from '#lib/server/asset-cleanup.ts';
import { db } from '#lib/server/db/index.ts';
import { certificates, templates } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import type { TemplateCanvasState } from '#lib/types/certflow.ts';
import type { RequestHandler } from './$types';

const updateTemplateSchema = z.object({
	name: z.string().trim().min(1).max(120).optional(),
	assignedRoles: z.array(z.string().trim().min(1)).optional(),
	rankingRule: z
		.object({
			mode: z.enum(['any', 'has_ranking', 'no_ranking', 'specific_rankings']),
			values: z.array(z.string().trim().min(1)).optional(),
			propertyFilters: z.record(z.string(), z.array(z.string().trim())).optional()
		})
		.optional(),
	width: z.number().int().min(300).max(5000).optional(),
	height: z.number().int().min(300).max(5000).optional(),
	canvasState: z.unknown().optional()
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = updateTemplateSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid template update');
	}

	const updateValues: Partial<typeof templates.$inferInsert> = {
		updatedAt: new Date()
	};
	if (parsed.data.name !== undefined) updateValues.name = parsed.data.name;
	if (parsed.data.assignedRoles !== undefined)
		updateValues.assignedRoles = parsed.data.assignedRoles;
	if (parsed.data.rankingRule !== undefined) updateValues.rankingRule = parsed.data.rankingRule;
	if (parsed.data.width !== undefined) updateValues.width = parsed.data.width;
	if (parsed.data.height !== undefined) updateValues.height = parsed.data.height;
	if (parsed.data.canvasState !== undefined) {
		updateValues.canvasState = parsed.data.canvasState as TemplateCanvasState;
	}

	const [updated] = await db
		.update(templates)
		.set(updateValues)
		.where(and(eq(templates.id, params.templateId), eq(templates.projectId, project.id)))
		.returning();

	if (!updated) throw error(404, 'Template not found');

	if (parsed.data.canvasState !== undefined) {
		void pruneUnusedProjectAssets(project.id).catch(() => {});
	}

	return json({ template: updated });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const projectTemplates = await db
		.select()
		.from(templates)
		.where(eq(templates.projectId, project.id))
		.orderBy(asc(templates.createdAt));

	const target = projectTemplates.find((t) => t.id === params.templateId);
	if (!target) throw error(404, 'Template not found');

	if (projectTemplates.length <= 1) {
		throw error(400, 'A project must keep at least one template.');
	}

	const remaining = projectTemplates.filter((t) => t.id !== target.id);
	const fallback = remaining.find((t) => t.isDefault) ?? remaining[0];

	await db.transaction(async (tx) => {
		// Reassign any generated certificates referencing this template so deletion obeys foreign keys.
		await tx
			.update(certificates)
			.set({
				templateId: fallback.id,
				certName: fallback.name,
				updatedAt: new Date()
			})
			.where(and(eq(certificates.projectId, project.id), eq(certificates.templateId, target.id)));

		if (target.isDefault) {
			await tx
				.update(templates)
				.set({ isDefault: true, updatedAt: new Date() })
				.where(eq(templates.id, fallback.id));
		}

		await tx
			.delete(templates)
			.where(and(eq(templates.id, target.id), eq(templates.projectId, project.id)));
	});

	void pruneUnusedProjectAssets(project.id).catch(() => {});

	return json({ deleted: true, nextTemplateId: fallback.id });
};
