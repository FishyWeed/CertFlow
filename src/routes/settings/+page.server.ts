import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { senderProfiles } from '#lib/server/db/schema.ts';
import { getMailCapabilities } from '#lib/server/mail.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const rows = await db
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
			smtpPassEncrypted: senderProfiles.smtpPassEncrypted
		})
		.from(senderProfiles)
		.where(eq(senderProfiles.userId, locals.user.id))
		.orderBy(desc(senderProfiles.createdAt));

	const profiles = rows.map(({ smtpPassEncrypted, ...rest }) => ({
		...rest,
		hasSmtpPassword: Boolean(smtpPassEncrypted)
	}));

	return {
		user: locals.user,
		profiles,
		mailCapabilities: getMailCapabilities()
	};
};
