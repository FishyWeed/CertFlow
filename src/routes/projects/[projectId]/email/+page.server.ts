import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { emailJobs, emailLogs, senderProfiles } from '#lib/server/db/schema.ts';
import { isLocalOutboxMode } from '#lib/server/mail.ts';
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

	return {
		senderProfiles: profiles,
		emailJobs: jobs.map((job) => ({
			...job,
			failedErrors: errorsByJobId.get(job.id) ?? []
		})),
		isLocalOutbox: isLocalOutboxMode()
	};
};
