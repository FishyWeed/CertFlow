import { randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import {
	certificates,
	emailJobs,
	emailLogs,
	projects,
	senderProfiles
} from '#lib/server/db/schema.ts';
import {
	interpolateEmailTemplate,
	sendCertificateEmail,
	type MailDeliveryMode,
	type SenderConfig
} from '#lib/server/mail.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import type { RequestHandler } from './$types';

const sendBatchSchema = z.object({
	senderMode: z.enum(['account', 'custom_reply_to', 'profile']),
	senderProfileId: z.string().optional(),
	customSenderName: z.string().trim().max(120).optional(),
	customSenderEmail: z.string().trim().email().optional(),
	subjectTemplate: z.string().trim().min(1).max(200),
	bodyTemplate: z.string().trim().min(1).max(5000),
	attachmentFormat: z.enum(['pdf', 'png', 'jpg']),
	items: z
		.array(
			z.object({
				certificateId: z.string().min(1),
				fileName: z.string().min(1),
				mimeType: z.string().min(1),
				base64Data: z.string().min(1)
			})
		)
		.min(1)
		.max(20)
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = sendBatchSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid email send payload');
	}

	const data = parsed.data;

	let sender: SenderConfig = {
		mode: 'account',
		senderName: locals.user.name,
		senderEmail: locals.user.email
	};

	if (data.senderMode === 'custom_reply_to' && data.customSenderEmail) {
		sender = {
			mode: 'custom_reply_to',
			senderName: data.customSenderName || locals.user.name,
			senderEmail: data.customSenderEmail
		};
	} else if (data.senderMode === 'profile' && data.senderProfileId) {
		const [profile] = await db
			.select()
			.from(senderProfiles)
			.where(
				and(eq(senderProfiles.id, data.senderProfileId), eq(senderProfiles.userId, locals.user.id))
			)
			.limit(1);
		if (!profile) throw error(404, 'Sender profile not found');
		sender = {
			mode: profile.mode,
			senderName: profile.senderName,
			senderEmail: profile.senderEmail,
			smtpHost: profile.smtpHost,
			smtpPort: profile.smtpPort,
			smtpSecure: profile.smtpSecure,
			smtpUser: profile.smtpUser,
			smtpPassEncrypted: profile.smtpPassEncrypted
		};
	}

	// Persist the latest email draft and sender selection onto the project.
	await db
		.update(projects)
		.set({
			emailDefaults: {
				...project.emailDefaults,
				senderMode: data.senderMode,
				senderProfileId:
					data.senderMode === 'profile'
						? (data.senderProfileId ?? null)
						: (project.emailDefaults.senderProfileId ?? null),
				customSenderName:
					data.senderMode === 'custom_reply_to'
						? (data.customSenderName ?? '')
						: (project.emailDefaults.customSenderName ?? ''),
				customSenderEmail:
					data.senderMode === 'custom_reply_to'
						? (data.customSenderEmail ?? '')
						: (project.emailDefaults.customSenderEmail ?? ''),
				subjectTemplate: data.subjectTemplate,
				bodyTemplate: data.bodyTemplate,
				attachmentFormat: data.attachmentFormat
			},
			updatedAt: new Date()
		})
		.where(eq(projects.id, project.id));

	const jobId = randomUUID();
	await db.insert(emailJobs).values({
		id: jobId,
		projectId: project.id,
		senderProfileId: data.senderMode === 'profile' ? data.senderProfileId ?? null : null,
		senderEmailSnapshot: sender.senderEmail,
		subjectTemplate: data.subjectTemplate,
		bodyTemplate: data.bodyTemplate,
		attachmentFormat: data.attachmentFormat,
		status: 'processing',
		totalCount: data.items.length
	});

	let sentCount = 0;
	let failedCount = 0;
	let skippedNoEmailCount = 0;
	let deliveryMode: MailDeliveryMode = 'smtp';
	let firstError: string | null = null;

	for (const item of data.items) {
		const [cert] = await db
			.select()
			.from(certificates)
			.where(and(eq(certificates.id, item.certificateId), eq(certificates.projectId, project.id)))
			.limit(1);

		if (!cert || !cert.email) {
			skippedNoEmailCount += 1;
			continue;
		}

		const vars: Record<string, string> = {
			name: cert.recipientName,
			title: cert.certTitle,
			role: cert.role,
			rank: cert.ranking,
			ranking: cert.ranking,
			certName: cert.certName,
			certCode: cert.certCode,
			...(cert.customProperties ?? {})
		};

		try {
			const bytes = Uint8Array.from(Buffer.from(item.base64Data, 'base64'));
			const result = await sendCertificateEmail({
				sender,
				to: cert.email,
				subject: interpolateEmailTemplate(data.subjectTemplate, vars),
				textBody: interpolateEmailTemplate(data.bodyTemplate, vars),
				attachmentFileName: item.fileName,
				attachmentBytes: bytes,
				attachmentMimeType: item.mimeType
			});

			deliveryMode = result.deliveryMode;
			sentCount += 1;
			try {
				await db
					.update(certificates)
					.set({ emailStatus: 'sent', lastSentAt: new Date(), updatedAt: new Date() })
					.where(eq(certificates.id, cert.id));

				await db.insert(emailLogs).values({
					id: randomUUID(),
					jobId,
					certificateId: cert.id,
					toEmail: cert.email,
					status: 'sent',
					providerMessageId: result.messageId
				});
			} catch {
				// Ignore stale certificate foreign-key errors if certificates were regenerated mid-send.
			}
		} catch (err) {
			failedCount += 1;
			const message = err instanceof Error ? err.message : 'SMTP delivery failed';
			if (!firstError) firstError = message;
			try {
				await db
					.update(certificates)
					.set({ emailStatus: 'failed', updatedAt: new Date() })
					.where(eq(certificates.id, cert.id));

				await db.insert(emailLogs).values({
					id: randomUUID(),
					jobId,
					certificateId: cert.id,
					toEmail: cert.email,
					status: 'failed',
					errorMessage: message
				});
			} catch {
				// Ignore stale certificate foreign-key errors if certificates were regenerated mid-send.
			}
		}
	}

	await db
		.update(emailJobs)
		.set({
			status: failedCount > 0 && sentCount === 0 ? 'failed' : 'completed',
			sentCount,
			failedCount,
			skippedNoEmailCount,
			completedAt: new Date()
		})
		.where(eq(emailJobs.id, jobId));

	return json({ jobId, sentCount, failedCount, skippedNoEmailCount, deliveryMode, firstError });
};
