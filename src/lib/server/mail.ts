import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import {
	DEFAULT_FROM_EMAIL,
	DEFAULT_FROM_NAME,
	SMTP_HOST,
	SMTP_PASS,
	SMTP_PORT,
	SMTP_SECURE,
	SMTP_USER
} from '$app/env/private';
import { decryptSecret } from './crypto.ts';

export interface SenderConfig {
	mode: 'account' | 'custom_reply_to' | 'smtp';
	senderName: string;
	senderEmail: string;
	smtpHost?: string | null;
	smtpPort?: number | null;
	smtpSecure?: boolean | null;
	smtpUser?: string | null;
	smtpPassEncrypted?: string | null;
}

export interface SendCertificateEmailInput {
	sender: SenderConfig;
	to: string;
	subject: string;
	textBody: string;
	attachmentFileName: string;
	attachmentBytes: Uint8Array;
	attachmentMimeType: string;
}

/**
 * Replaces `{{key}}` tokens in an email subject or body using certificate properties.
 */
export function interpolateEmailTemplate(
	template: string,
	values: Record<string, string>
): string {
	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

/**
 * Sends a single certificate email using:
 * - the user's encrypted custom SMTP server (mode === 'smtp'), OR
 * - local file outbox (when SMTP_HOST === 'local-outbox', zero external services needed in dev), OR
 * - platform default SMTP relay (Mailpit, Brevo, Resend, etc.) with Reply-To set to the chosen sender.
 */
export async function sendCertificateEmail(input: SendCertificateEmailInput) {
	const useCustomSmtp =
		input.sender.mode === 'smtp' && input.sender.smtpHost && input.sender.smtpPort;

	const fromHeader = useCustomSmtp
		? `"${input.sender.senderName}" <${input.sender.senderEmail}>`
		: `"${input.sender.senderName || DEFAULT_FROM_NAME}" <${DEFAULT_FROM_EMAIL}>`;

	if (!useCustomSmtp && SMTP_HOST === 'local-outbox') {
		const outboxDir = resolve('./.local/outbox');
		await mkdir(outboxDir, { recursive: true });
		const messageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@certflow.local`;
		const safeTo = input.to.replace(/[^a-z0-9@._-]/gi, '_');
		const recordPath = join(outboxDir, `${Date.now()}-${safeTo}.json`);
		await writeFile(
			recordPath,
			JSON.stringify(
				{
					messageId,
					from: fromHeader,
					replyTo: input.sender.senderEmail,
					to: input.to,
					subject: input.subject,
					textBody: input.textBody,
					attachment: {
						fileName: input.attachmentFileName,
						mimeType: input.attachmentMimeType,
						sizeBytes: input.attachmentBytes.byteLength
					},
					recordedAt: new Date().toISOString()
				},
				null,
				2
			),
			'utf8'
		);
		return { messageId, deliveryMode: 'local_outbox' as const };
	}

	const transporter = useCustomSmtp
		? nodemailer.createTransport({
				host: input.sender.smtpHost!,
				port: input.sender.smtpPort!,
				secure: Boolean(input.sender.smtpSecure),
				auth:
					input.sender.smtpUser && input.sender.smtpPassEncrypted
						? {
								user: input.sender.smtpUser,
								pass: decryptSecret(input.sender.smtpPassEncrypted)
							}
						: undefined
			})
		: nodemailer.createTransport({
				host: SMTP_HOST,
				port: SMTP_PORT,
				secure: SMTP_SECURE,
				auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
			});

	const info = await transporter.sendMail({
		from: fromHeader,
		replyTo: input.sender.senderEmail,
		to: input.to,
		subject: input.subject,
		text: input.textBody,
		attachments: [
			{
				filename: input.attachmentFileName,
				content: Buffer.from(input.attachmentBytes),
				contentType: input.attachmentMimeType
			}
		]
	});

	return { messageId: info.messageId, deliveryMode: 'smtp' as const };
}
