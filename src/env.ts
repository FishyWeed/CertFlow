import { defineEnvVars } from '@sveltejs/kit/env';

const optionalString = (fallback = '') => (value: string | undefined) => value ?? fallback;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'PostgreSQL URL (production) or local folder path for embedded PGlite (local dev)',
		schema: optionalString('./.local/pgdata')
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret key used by Better Auth for signing sessions',
		schema: optionalString('dev-insecure-secret-change-me-in-production-32chars')
	},
	BETTER_AUTH_URL: {
		description: 'Base URL for Better Auth callbacks',
		schema: optionalString('http://localhost:5678')
	},
	PUBLIC_APP_URL: {
		description: 'Public origin URL for links and auth callbacks',
		schema: optionalString('http://localhost:5678')
	},
	ENCRYPTION_KEY: {
		description: '64-char hex key (32 bytes) for AES-256-GCM encryption of user SMTP secrets',
		schema: optionalString('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
	},
	STORAGE_DRIVER: {
		description: 'Asset storage backend: local or s3',
		schema: optionalString('local')
	},
	LOCAL_UPLOAD_DIR: {
		description: 'Local directory for uploaded assets when STORAGE_DRIVER=local',
		schema: optionalString('./uploads')
	},
	CERTFLOW_SELF_HOSTED: {
		description: 'Enables the first-run /setup wizard for Docker and portable self-hosted launches',
		schema: (value) => value === 'true'
	},
	CERTFLOW_DATA_DIR: {
		description: 'Persistent root directory for config.json, uploads, pgdata and outbox in self-hosted mode',
		schema: optionalString('./.local')
	},
	CERTFLOW_CONFIG_PATH: {
		description: 'Optional explicit path override for persisted runtime config.json',
		schema: optionalString('')
	},
	CERTFLOW_APP_DIR: {
		description: 'Resolved application root directory used to locate drizzle/ migrations in portable builds',
		schema: optionalString('')
	},
	ALLOW_CUSTOM_SMTP: {
		description: 'Enables raw SMTP sender profiles in production when outbound SMTP ports are open',
		schema: (value) => value === 'true'
	},
	SMTP_HOST: {
		description: 'Default outbound SMTP host (use "local-outbox" for zero-config local dev)',
		schema: optionalString('local-outbox')
	},
	SMTP_PORT: {
		description: 'Default outbound SMTP port',
		schema: (value) => (value ? Number(value) : 1025)
	},
	SMTP_SECURE: {
		description: 'Whether default SMTP uses TLS',
		schema: (value) => value === 'true'
	},
	SMTP_USER: {
		description: 'Default outbound SMTP username',
		schema: optionalString('')
	},
	SMTP_PASS: {
		description: 'Default outbound SMTP password',
		schema: optionalString('')
	},
	DEFAULT_FROM_NAME: {
		description: 'Default display name on outbound emails',
		schema: optionalString('CertFlow')
	},
	DEFAULT_FROM_EMAIL: {
		description: 'Default verified From address on outbound emails',
		schema: optionalString('certificates@certflow.local')
	},
	BREVO_API_KEY: {
		description: 'Optional Brevo HTTPS API key (free 300 emails/day over port 443, works on Railway Free/Hobby)',
		schema: optionalString('')
	},
	RESEND_API_KEY: {
		description: 'Optional Resend HTTPS API key (free 100 emails/day over port 443, works on Railway Free/Hobby)',
		schema: optionalString('')
	}
});
