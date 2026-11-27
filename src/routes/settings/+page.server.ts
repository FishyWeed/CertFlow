import { redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getQuotaSettingsSnapshot, isUserAdmin } from '#lib/server/app-settings.ts';
import { getUserAccountUsage } from '#lib/server/asset-cleanup.ts';
import { db } from '#lib/server/db/index.ts';
import { senderProfiles } from '#lib/server/db/schema.ts';
import { getMailCapabilities } from '#lib/server/mail.ts';
import { getPortableRuntimeInfo, getStagedPortableUpdate } from '#lib/server/portable-updater.ts';
import { isLocalAppRuntime } from '#lib/server/runtime-config.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const [rows, usage, isAdmin] = await Promise.all([
		db
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
			.orderBy(desc(senderProfiles.createdAt)),
		getUserAccountUsage(locals.user.id),
		isUserAdmin(locals.user)
	]);

	const profiles = rows.map(({ smtpPassEncrypted, ...rest }) => ({
		...rest,
		hasSmtpPassword: Boolean(smtpPassEncrypted)
	}));

	const portableInfo = getPortableRuntimeInfo();
	const stagedUpdate = getStagedPortableUpdate(portableInfo);
	const canShowUpdates = portableInfo.isPortable || isLocalAppRuntime();
	const adminQuotas = isAdmin ? await getQuotaSettingsSnapshot() : null;

	return {
		user: locals.user,
		isAdmin,
		adminQuotas,
		profiles,
		usage,
		mailCapabilities: getMailCapabilities(),
		portableInfo: {
			isPortable: portableInfo.isPortable,
			canShowUpdates,
			currentVersion: portableInfo.currentVersion || 'dev',
			target: portableInfo.target,
			stagedVersion: stagedUpdate?.version ?? null
		}
	};
};
