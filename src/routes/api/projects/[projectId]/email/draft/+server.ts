import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { projects, senderProfiles } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import type { ProjectEmailDefaults } from '#lib/types/certflow.ts';
import type { RequestHandler } from './$types';

const emailAddressSchema = z.string().email();

const saveEmailDraftSchema = z.object({
	senderMode: z.enum(['account', 'custom_reply_to', 'profile']),
	senderProfileId: z.string().trim().max(120).nullable().optional(),
	customSenderName: z.string().trim().max(120).optional().default(''),
	customSenderEmail: z
		.string()
		.trim()
		.max(255)
		.optional()
		.default('')
		.refine(
			(val) => val.length === 0 || emailAddressSchema.safeParse(val).success,
			'Enter a valid sender email address.'
		),
	subjectTemplate: z.string().max(200),
	bodyTemplate: z.string().max(5000),
	attachmentFormat: z.enum(['pdf', 'png', 'jpg'])
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = saveEmailDraftSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid email draft payload.');
	}

	const data = parsed.data;
	let verifiedProfileId: string | null = null;

	if (data.senderProfileId) {
		const [profile] = await db
			.select({ id: senderProfiles.id })
			.from(senderProfiles)
			.where(
				and(eq(senderProfiles.id, data.senderProfileId), eq(senderProfiles.userId, locals.user.id))
			)
			.limit(1);
		if (!profile) {
			throw error(404, 'Saved sender profile not found.');
		}
		verifiedProfileId = profile.id;
	}

	const nextDefaults: ProjectEmailDefaults = {
		senderMode: data.senderMode,
		senderProfileId: verifiedProfileId,
		customSenderName: data.customSenderName,
		customSenderEmail: data.customSenderEmail,
		subjectTemplate: data.subjectTemplate,
		bodyTemplate: data.bodyTemplate,
		attachmentFormat: data.attachmentFormat
	};

	await db
		.update(projects)
		.set({
			emailDefaults: nextDefaults,
			updatedAt: new Date()
		})
		.where(eq(projects.id, project.id));

	return json({ emailDefaults: nextDefaults });
};
