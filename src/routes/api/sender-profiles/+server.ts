import { randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { encryptSecret } from '#lib/server/crypto.ts';
import { db } from '#lib/server/db/index.ts';
import { senderProfiles } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

const createSenderSchema = z.object({
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

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const profiles = await db
		.select({
			id: senderProfiles.id,
			label: senderProfiles.label,
			mode: senderProfiles.mode,
			senderName: senderProfiles.senderName,
			senderEmail: senderProfiles.senderEmail,
			smtpHost: senderProfiles.smtpHost,
			smtpPort: senderProfiles.smtpPort,
			smtpSecure: senderProfiles.smtpSecure,
			smtpUser: senderProfiles.smtpUser,
			isDefault: senderProfiles.isDefault
		})
		.from(senderProfiles)
		.where(eq(senderProfiles.userId, locals.user.id))
		.orderBy(desc(senderProfiles.createdAt));

	return json({ profiles });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const parsed = createSenderSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid sender profile');
	}

	const d = parsed.data;
	const [created] = await db
		.insert(senderProfiles)
		.values({
			id: randomUUID(),
			userId: locals.user.id,
			label: d.label,
			mode: d.mode,
			senderName: d.senderName,
			senderEmail: d.senderEmail,
			smtpHost: d.mode === 'smtp' ? d.smtpHost ?? null : null,
			smtpPort: d.mode === 'smtp' ? d.smtpPort ?? 587 : null,
			smtpSecure: d.mode === 'smtp' ? Boolean(d.smtpSecure) : false,
			smtpUser: d.mode === 'smtp' ? d.smtpUser ?? null : null,
			smtpPassEncrypted:
				d.mode === 'smtp' && d.smtpPassword ? encryptSecret(d.smtpPassword) : null
		})
		.returning({
			id: senderProfiles.id,
			label: senderProfiles.label,
			mode: senderProfiles.mode,
			senderName: senderProfiles.senderName,
			senderEmail: senderProfiles.senderEmail
		});

	return json({ profile: created }, { status: 201 });
};
