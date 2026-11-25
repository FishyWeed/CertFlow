import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { encryptSecret } from '#lib/server/crypto.ts';
import { db } from '#lib/server/db/index.ts';
import { senderProfiles } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

const updateSenderSchema = z.object({
	label: z.string().trim().min(1).max(100),
	mode: z.enum(['account', 'custom_reply_to', 'smtp']),
	senderName: z.string().trim().min(1).max(120),
	senderEmail: z.string().trim().email(),
	smtpHost: z.string().trim().optional(),
	smtpPort: z.number().int().min(1).max(65535).optional(),
	smtpSecure: z.boolean().optional(),
	smtpUser: z.string().trim().optional(),
	smtpPassword: z.string().optional()
});

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const [existing] = await db
		.select()
		.from(senderProfiles)
		.where(and(eq(senderProfiles.id, params.profileId), eq(senderProfiles.userId, locals.user.id)))
		.limit(1);

	if (!existing) throw error(404, 'Sender profile not found.');

	const body = await request.json();
	const parsed = updateSenderSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid sender profile.');
	}

	const d = parsed.data;
	const isSmtp = d.mode === 'smtp';
	const nextEncryptedPass = isSmtp
		? d.smtpPassword && d.smtpPassword.length > 0
			? encryptSecret(d.smtpPassword)
			: existing.smtpPassEncrypted
		: null;

	const [updated] = await db
		.update(senderProfiles)
		.set({
			label: d.label,
			mode: d.mode,
			senderName: d.senderName,
			senderEmail: d.senderEmail,
			smtpHost: isSmtp ? (d.smtpHost ?? null) : null,
			smtpPort: isSmtp ? (d.smtpPort ?? 465) : null,
			smtpSecure: isSmtp ? Boolean(d.smtpSecure) : false,
			smtpUser: isSmtp ? (d.smtpUser ?? null) : null,
			smtpPassEncrypted: nextEncryptedPass,
			updatedAt: new Date()
		})
		.where(and(eq(senderProfiles.id, existing.id), eq(senderProfiles.userId, locals.user.id)))
		.returning({
			id: senderProfiles.id,
			label: senderProfiles.label,
			mode: senderProfiles.mode,
			senderName: senderProfiles.senderName,
			senderEmail: senderProfiles.senderEmail,
			smtpHost: senderProfiles.smtpHost,
			smtpPort: senderProfiles.smtpPort,
			smtpSecure: senderProfiles.smtpSecure,
			smtpUser: senderProfiles.smtpUser
		});

	return json({
		profile: {
			...updated,
			hasSmtpPassword: Boolean(nextEncryptedPass)
		}
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const [deleted] = await db
		.delete(senderProfiles)
		.where(and(eq(senderProfiles.id, params.profileId), eq(senderProfiles.userId, locals.user.id)))
		.returning({ id: senderProfiles.id });

	if (!deleted) throw error(404, 'Sender profile not found.');

	return json({ deletedId: deleted.id });
};
