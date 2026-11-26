import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { certificates } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import type { RequestHandler } from './$types';

const updateCertSchema = z.object({
	templateId: z.string().min(1).optional(),
	certName: z.string().trim().min(1).max(160).optional(),
	recipientName: z.string().trim().min(1).max(160).optional(),
	certTitle: z.string().trim().max(200).optional(),
	role: z.string().trim().max(100).optional(),
	ranking: z.string().trim().max(160).optional(),
	email: z.string().trim().email().nullable().optional(),
	customProperties: z.record(z.string(), z.string()).optional()
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = updateCertSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid certificate properties');
	}

	const nextValues: Partial<typeof certificates.$inferInsert> = {
		...parsed.data,
		updatedAt: new Date()
	};

	if (parsed.data.email !== undefined) {
		nextValues.emailStatus = parsed.data.email ? 'not_sent' : 'no_email';
	}

	const [updated] = await db
		.update(certificates)
		.set(nextValues)
		.where(and(eq(certificates.id, params.certificateId), eq(certificates.projectId, project.id)))
		.returning();

	if (!updated) throw error(404, 'Certificate not found');

	return json({ certificate: updated });
};
