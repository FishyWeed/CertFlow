import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { decryptSecret } from './crypto.ts';
import { getRuntimeConfig } from './runtime-config.ts';

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

export type MailDeliveryMode = 'local_outbox' | 'smtp' | 'api';

export interface MailCapabilities {
	isProduction: boolean;
	hasServerRelay: boolean;
	allowRawSmtp: boolean;
	isLocalOutbox: boolean;
}

/**
 * Reports which outbound mail transports are available in the current runtime environment.
 * Production deployments without a server-wide relay expose only HTTPS API sender profiles (Brevo/Resend).
 */
export function getMailCapabilities(): MailCapabilities {
	const cfg = getRuntimeConfig();
	const isProduction = process.env.NODE_ENV === 'production';
	const hasServerRelay = Boolean(
		cfg.brevoApiKey || cfg.resendApiKey || (cfg.smtpHost && cfg.smtpHost !== 'local-outbox')
	);
	const allowRawSmtp = !isProduction || cfg.allowCustomSmtp;
	const isLocalOutbox = !isProduction && !hasServerRelay;
	return { isProduction, hasServerRelay, allowRawSmtp, isLocalOutbox };
}

/**
 * Returns true only when no HTTPS API provider (Brevo/Resend) and no real SMTP host are configured.
 */
export function isLocalOutboxMode(): boolean {
	return getMailCapabilities().isLocalOutbox;
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

async function sendViaBrevoApi(
	input: SendCertificateEmailInput,
	apiKey: string,
	explicitFromEmail?: string
): Promise<{ messageId: string }> {
	const cfg = getRuntimeConfig();
	const fromEmail =
		explicitFromEmail ||
		(cfg.defaultFromEmail && cfg.defaultFromEmail !== 'certificates@certflow.local'
			? cfg.defaultFromEmail
			: input.sender.senderEmail);
	const fromName = input.sender.senderName || cfg.defaultFromName || 'CertFlow';

	const res = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: {
			'api-key': apiKey.trim(),
			'content-type': 'application/json',
			accept: 'application/json'
		},
		body: JSON.stringify({
			sender: { name: fromName, email: fromEmail },
			replyTo: { name: fromName, email: input.sender.senderEmail || fromEmail },
			to: [{ email: input.to }],
			subject: input.subject,
			textContent: input.textBody,
			attachment: [
				{
					name: input.attachmentFileName,
					content: Buffer.from(input.attachmentBytes).toString('base64')
				}
			]
		})
	});

	const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
	if (!res.ok) {
		throw new Error(data.message || `Brevo API error (${res.status})`);
	}
	return { messageId: data.messageId ?? `brevo-${Date.now()}` };
}

async function sendViaResendApi(
	input: SendCertificateEmailInput,
	apiKey: string,
	explicitFromEmail?: string
): Promise<{ messageId: string }> {
	const cfg = getRuntimeConfig();
	const fromEmail =
		explicitFromEmail ||
		(cfg.defaultFromEmail && cfg.defaultFromEmail !== 'certificates@certflow.local'
			? cfg.defaultFromEmail
			: input.sender.senderEmail);
	const fromName = input.sender.senderName || cfg.defaultFromName || 'CertFlow';

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${apiKey.trim()}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			from: `${fromName} <${fromEmail}>`,
			reply_to: input.sender.senderEmail || fromEmail,
			to: [input.to],
			subject: input.subject,
			text: input.textBody,
			attachments: [
				{
					filename: input.attachmentFileName,
					content: Buffer.from(input.attachmentBytes).toString('base64')
				}
			]
		})
	});

	const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
	if (!res.ok) {
		throw new Error(data.message || `Resend API error (${res.status})`);
	}
	return { messageId: data.id ?? `resend-${Date.now()}` };
}

/**
 * Sends a single certificate email using:
 * - a saved Brevo or Resend HTTPS API sender profile (port 443, works on Railway Free/Hobby), OR
 * - the user's encrypted custom SMTP server (mode === 'smtp'), OR
 * - server-wide Brevo/Resend HTTPS API (when BREVO_API_KEY / RESEND_API_KEY is set), OR
 * - local file outbox (when SMTP_HOST === 'local-outbox', zero external services needed in dev), OR
 * - platform default SMTP relay with Reply-To set to the chosen sender.
 */
export async function sendCertificateEmail(
	input: SendCertificateEmailInput
): Promise<{ messageId: string; deliveryMode: MailDeliveryMode }> {
	const profileHost = input.sender.smtpHost?.trim().toLowerCase() ?? '';
	if (input.sender.mode === 'smtp' && profileHost === 'api.brevo.com') {
		if (!input.sender.smtpPassEncrypted) {
			throw new Error('Saved Brevo profile is missing an API key. Edit the profile in Account Settings.');
		}
		const apiKey = decryptSecret(input.sender.smtpPassEncrypted).trim();
		const res = await sendViaBrevoApi(input, apiKey, input.sender.senderEmail);
		return { messageId: res.messageId, deliveryMode: 'api' };
	}

	if (input.sender.mode === 'smtp' && profileHost === 'api.resend.com') {
		if (!input.sender.smtpPassEncrypted) {
			throw new Error('Saved Resend profile is missing an API key. Edit the profile in Account Settings.');
		}
		const apiKey = decryptSecret(input.sender.smtpPassEncrypted).trim();
		const res = await sendViaResendApi(input, apiKey, input.sender.senderEmail);
		return { messageId: res.messageId, deliveryMode: 'api' };
	}

	const cfg = getRuntimeConfig();
	const useCustomSmtp =
		input.sender.mode === 'smtp' && input.sender.smtpHost && input.sender.smtpPort;

	if (!useCustomSmtp && cfg.brevoApiKey) {
		const res = await sendViaBrevoApi(input, cfg.brevoApiKey);
		return { messageId: res.messageId, deliveryMode: 'api' };
	}

	if (!useCustomSmtp && cfg.resendApiKey) {
		const res = await sendViaResendApi(input, cfg.resendApiKey);
		return { messageId: res.messageId, deliveryMode: 'api' };
	}

	const fromHeader = useCustomSmtp
		? `"${input.sender.senderName}" <${input.sender.senderEmail}>`
		: `"${input.sender.senderName || cfg.defaultFromName}" <${cfg.defaultFromEmail}>`;

	if (!useCustomSmtp && cfg.smtpHost === 'local-outbox') {
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
		return { messageId, deliveryMode: 'local_outbox' };
	}

	const transporter = useCustomSmtp
		? nodemailer.createTransport({
				host: input.sender.smtpHost!,
				port: input.sender.smtpPort!,
				secure: Boolean(input.sender.smtpSecure),
				connectionTimeout: 15_000,
				greetingTimeout: 15_000,
				socketTimeout: 30_000,
				auth:
					input.sender.smtpUser && input.sender.smtpPassEncrypted
						? {
								user: input.sender.smtpUser,
								pass: decryptSecret(input.sender.smtpPassEncrypted).trim()
							}
						: undefined
			})
		: nodemailer.createTransport({
				host: cfg.smtpHost,
				port: cfg.smtpPort,
				secure: cfg.smtpSecure,
				connectionTimeout: 15_000,
				greetingTimeout: 15_000,
				socketTimeout: 30_000,
				auth: cfg.smtpUser && cfg.smtpPass ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined
			});

	try {
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
		return { messageId: info.messageId, deliveryMode: 'smtp' };
	} catch (err) {
		const rawMessage = err instanceof Error ? err.message : 'Email delivery failed';
		if (/timeout|ETIMEDOUT|ENETUNREACH/i.test(rawMessage) && process.env.NODE_ENV === 'production') {
			throw new Error(
				'Could not connect to the mail server. Use a Brevo or Resend sender profile in Account Settings instead.'
			);
		}
		throw err;
	}
}
