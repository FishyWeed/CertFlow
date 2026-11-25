import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { emailJobs, emailLogs, senderProfiles } from '#lib/server/db/schema.ts';
import { getMailCapabilities } from '#lib/server/mail.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user, project } = await parent();

	const [profiles, jobs] = await Promise.all([
		db
			.select({
				id: senderProfiles.id,
				label: senderProfiles.label,
				mode: senderProfiles.mode,
				senderName: senderProfiles.senderName,
				senderEmail: senderProfiles.senderEmail,
				smtpHost: senderProfiles.smtpHost
			})
			.from(senderProfiles)
			.where(eq(senderProfiles.userId, user.id))
			.orderBy(desc(senderProfiles.createdAt)),
		db
			.select()
			.from(emailJobs)
			.where(eq(emailJobs.projectId, project.id))
			.orderBy(desc(emailJobs.createdAt))
			.limit(10)
	]);

	const jobIds = jobs.map((j) => j.id);
	const failedLogs =
		jobIds.length > 0
			? await db
					.select({
						jobId: emailLogs.jobId,
						toEmail: emailLogs.toEmail,
						errorMessage: emailLogs.errorMessage
					})
					.from(emailLogs)
					.where(and(inArray(emailLogs.jobId, jobIds), eq(emailLogs.status, 'failed')))
			: [];

	const errorsByJobId = new Map<string, Array<{ toEmail: string; errorMessage: string }>>();
	for (const log of failedLogs) {
		const list = errorsByJobId.get(log.jobId) ?? [];
		list.push({
			toEmail: log.toEmail,
			errorMessage: log.errorMessage ?? 'Delivery failed'
		});
		errorsByJobId.set(log.jobId, list);
	}

	const mailCapabilities = getMailCapabilities();
	const usableProfiles = profiles.filter((p) => {
		const host = p.smtpHost?.trim().toLowerCase() ?? '';
		const isApiProfile = p.mode === 'smtp' && (host === 'api.brevo.com' || host === 'api.resend.com');
		if (isApiProfile) return true;
		if (p.mode === 'smtp') return mailCapabilities.allowRawSmtp;
		return mailCapabilities.hasServerRelay || mailCapabilities.isLocalOutbox;
	});

	return {
		senderProfiles: usableProfiles,
		emailJobs: jobs.map((job) => ({
			...job,
			failedErrors: errorsByJobId.get(job.id) ?? []
		})),
		mailCapabilities
	};
};
