import { error, fail, redirect } from '@sveltejs/kit';
import { join } from 'node:path';
import { z } from 'zod';
import { getAuth, resetAuthInstance } from '#lib/server/auth.ts';
import {
	isRemotePostgresUrl,
	resetDatabaseConnection,
	runDatabaseMigrations
} from '#lib/server/db/index.ts';
import {
	generateAuthSecret,
	generateEncryptionKey,
	needsInitialSetup,
	saveRuntimeConfig
} from '#lib/server/runtime-config.ts';
import type { Actions, PageServerLoad } from './$types';

const setupSchema = z.object({
	appUrl: z
		.string()
		.trim()
		.url('Enter a valid App URL starting with http:// or https://'),
	betterAuthSecret: z
		.string()
		.trim()
		.min(32, 'Session secret must be at least 32 characters'),
	encryptionKey: z
		.string()
		.trim()
		.regex(/^[0-9a-fA-F]{64}$/, 'Encryption key must be a 64-character hex string'),
	databaseMode: z.enum(['embedded', 'postgres']),
	databaseUrl: z.string().trim().optional().default(''),
	emailProvider: z.enum(['none', 'brevo', 'resend', 'smtp']),
	brevoApiKey: z.string().trim().optional().default(''),
	resendApiKey: z.string().trim().optional().default(''),
	smtpHost: z.string().trim().optional().default(''),
	smtpPort: z.coerce.number().int().min(1).max(65535).optional().default(587),
	smtpSecure: z.boolean().optional().default(false),
	smtpUser: z.string().trim().optional().default(''),
	smtpPass: z.string().optional().default(''),
	defaultFromName: z.string().trim().max(120).optional().default('CertFlow'),
	defaultFromEmail: z.string().trim().optional().default(''),
	adminName: z.string().trim().min(2, 'Admin name must be at least 2 characters').max(120),
	adminEmail: z.string().trim().email('Enter a valid admin email address'),
	adminPassword: z.string().min(8, 'Admin password must be at least 8 characters')
});

export const load: PageServerLoad = async ({ url }) => {
	if (!needsInitialSetup()) {
		throw redirect(302, '/');
	}

	const dataDir = process.env.CERTFLOW_DATA_DIR?.trim() || '/data';
	const detectedPostgresUrl =
		process.env.CERTFLOW_DEFAULT_DATABASE_URL?.trim() ||
		(isRemotePostgresUrl(process.env.DATABASE_URL?.trim() ?? '')
			? process.env.DATABASE_URL!.trim()
			: '');

	return {
		suggestedAppUrl: url.origin,
		suggestedAuthSecret: generateAuthSecret(),
		suggestedEncryptionKey: generateEncryptionKey(),
		detectedPostgresUrl,
		defaultEmbeddedDbPath: join(dataDir, 'pgdata')
	};
};

export const actions: Actions = {
	completeSetup: async ({ request }) => {
		if (!needsInitialSetup()) {
			throw error(403, 'Setup has already been completed.');
		}

		const fd = await request.formData();
		const parsed = setupSchema.safeParse({
			appUrl: String(fd.get('appUrl') ?? ''),
			betterAuthSecret: String(fd.get('betterAuthSecret') ?? ''),
			encryptionKey: String(fd.get('encryptionKey') ?? ''),
			databaseMode: String(fd.get('databaseMode') ?? 'embedded'),
			databaseUrl: String(fd.get('databaseUrl') ?? ''),
			emailProvider: String(fd.get('emailProvider') ?? 'none'),
			brevoApiKey: String(fd.get('brevoApiKey') ?? ''),
			resendApiKey: String(fd.get('resendApiKey') ?? ''),
			smtpHost: String(fd.get('smtpHost') ?? ''),
			smtpPort: fd.get('smtpPort') ? Number(fd.get('smtpPort')) : 587,
			smtpSecure: fd.get('smtpSecure') === 'on' || fd.get('smtpSecure') === 'true',
			smtpUser: String(fd.get('smtpUser') ?? ''),
			smtpPass: String(fd.get('smtpPass') ?? ''),
			defaultFromName: String(fd.get('defaultFromName') ?? 'CertFlow') || 'CertFlow',
			defaultFromEmail: String(fd.get('defaultFromEmail') ?? ''),
			adminName: String(fd.get('adminName') ?? ''),
			adminEmail: String(fd.get('adminEmail') ?? ''),
			adminPassword: String(fd.get('adminPassword') ?? '')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Please check the setup fields.'
			});
		}

		const input = parsed.data;
		const dataDir = process.env.CERTFLOW_DATA_DIR?.trim() || '/data';
		const resolvedDbUrl =
			input.databaseMode === 'postgres' ? input.databaseUrl : join(dataDir, 'pgdata');

		if (input.databaseMode === 'postgres' && !isRemotePostgresUrl(resolvedDbUrl)) {
			return fail(400, {
				error: 'Enter a PostgreSQL connection URL starting with postgresql:// or postgres://.'
			});
		}

		if (input.emailProvider === 'brevo' && !input.brevoApiKey) {
			return fail(400, { error: 'Enter your Brevo API key (starting with xkeysib-).' });
		}
		if (input.emailProvider === 'resend' && !input.resendApiKey) {
			return fail(400, { error: 'Enter your Resend API key (starting with re_).' });
		}
		if (input.emailProvider === 'smtp' && !input.smtpHost) {
			return fail(400, { error: 'Enter an SMTP host name.' });
		}

		// Verify database connectivity and run migrations before persisting config.json.
		try {
			await runDatabaseMigrations(resolvedDbUrl);
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Database connection failed.';
			return fail(400, {
				error: `Could not connect to or initialise the database: ${msg}`
			});
		}

		const cleanAppUrl = input.appUrl.replace(/\/+$/, '');
		saveRuntimeConfig({
			setupCompleted: true,
			databaseUrl: resolvedDbUrl,
			betterAuthUrl: cleanAppUrl,
			betterAuthSecret: input.betterAuthSecret,
			encryptionKey: input.encryptionKey.toLowerCase(),
			storageDriver: 'local',
			localUploadDir: process.env.LOCAL_UPLOAD_DIR?.trim() || join(dataDir, 'uploads'),
			brevoApiKey: input.emailProvider === 'brevo' ? input.brevoApiKey : '',
			resendApiKey: input.emailProvider === 'resend' ? input.resendApiKey : '',
			smtpHost: input.emailProvider === 'smtp' ? input.smtpHost : 'local-outbox',
			smtpPort: input.emailProvider === 'smtp' ? input.smtpPort : 587,
			smtpSecure: input.emailProvider === 'smtp' ? input.smtpSecure : false,
			smtpUser: input.emailProvider === 'smtp' ? input.smtpUser : '',
			smtpPass: input.emailProvider === 'smtp' ? input.smtpPass : '',
			defaultFromName: input.defaultFromName || 'CertFlow',
			defaultFromEmail: input.defaultFromEmail || input.adminEmail,
			allowCustomSmtp: true
		});

		await resetDatabaseConnection();
		resetAuthInstance();

		let createdAndSignedIn = false;
		try {
			const auth = getAuth();
			await auth.api.signUpEmail({
				body: {
					name: input.adminName,
					email: input.adminEmail,
					password: input.adminPassword
				},
				headers: request.headers
			});
			createdAndSignedIn = true;
		} catch {
			// If this database already has an account for adminEmail, redirect cleanly to /login.
		}

		throw redirect(302, createdAndSignedIn ? '/dashboard' : '/login');
	}
};
