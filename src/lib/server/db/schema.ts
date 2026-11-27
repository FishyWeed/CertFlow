import {
	pgTable,
	text,
	timestamp,
	boolean,
	integer,
	jsonb,
	pgEnum,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import type {
	ColumnMapping,
	CriterionDefinition,
	ExportFormat,
	ProjectEmailDefaults,
	TemplateCanvasState,
	TemplateRankingRule
} from '#lib/types/certflow.ts';

// ============================================================================
// Enums
// ============================================================================

export const senderModeEnum = pgEnum('sender_mode', ['account', 'custom_reply_to', 'smtp']);

export const assetKindEnum = pgEnum('asset_kind', ['background', 'image', 'font']);

export const exportFormatEnum = pgEnum('export_format', ['pdf', 'png', 'jpg']);

export const certificateEmailStatusEnum = pgEnum('certificate_email_status', [
	'no_email',
	'not_sent',
	'queued',
	'sent',
	'failed'
]);

export const emailJobStatusEnum = pgEnum('email_job_status', [
	'pending',
	'processing',
	'completed',
	'failed'
]);

// ============================================================================
// Better Auth Core Tables
// ============================================================================

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_user_id_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

// ============================================================================
// CertFlow Domain Tables
// ============================================================================

/**
 * Sender profiles allow a user to send certificates using either:
 * - their signed-in account email (Reply-To)
 * - a separate custom email address (Reply-To)
 * - their own SMTP server credentials (true custom From: header, password AES-256-GCM encrypted)
 */
export const senderProfiles = pgTable(
	'sender_profiles',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		mode: senderModeEnum('mode').notNull().default('account'),
		senderName: text('sender_name').notNull(),
		senderEmail: text('sender_email').notNull(),
		smtpHost: text('smtp_host'),
		smtpPort: integer('smtp_port'),
		smtpSecure: boolean('smtp_secure').default(true),
		smtpUser: text('smtp_user'),
		smtpPassEncrypted: text('smtp_pass_encrypted'),
		isDefault: boolean('is_default').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('sender_profiles_user_id_idx').on(table.userId)]
);

/**
 * Projects represent an event or campaign (for example, "21st Malaysian Chess Festival 2026").
 * Each project owns multiple templates, imported spreadsheet rows and generated certificates.
 */
export const projects = pgTable(
	'projects',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		defaultCertTitle: text('default_cert_title').notNull().default(''),
		description: text('description'),
		criteriaConfig: jsonb('criteria_config').$type<CriterionDefinition[]>().notNull(),
		columnMapping: jsonb('column_mapping').$type<ColumnMapping>().notNull().default({}),
		sourceFileName: text('source_file_name'),
		sourceHeaders: jsonb('source_headers').$type<string[]>().notNull().default([]),
		emailDefaults: jsonb('email_defaults').$type<ProjectEmailDefaults>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('projects_user_id_idx').on(table.userId)]
);

/**
 * Certificate templates belonging to a project.
 * Supports multiple templates per project routed by role and optional ranking rule.
 */
export const templates = pgTable(
	'templates',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		assignedRoles: jsonb('assigned_roles').$type<string[]>().notNull().default([]),
		rankingRule: jsonb('ranking_rule')
			.$type<TemplateRankingRule>()
			.notNull()
			.default({ mode: 'any' }),
		isDefault: boolean('is_default').notNull().default(false),
		width: integer('width').notNull().default(1123), // A4 landscape @ 96 DPI base (scaled 3x on export)
		height: integer('height').notNull().default(794),
		canvasState: jsonb('canvas_state').$type<TemplateCanvasState>().notNull(),
		thumbnailUrl: text('thumbnail_url'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('templates_project_id_idx').on(table.projectId)]
);

/**
 * Uploaded binary assets (backgrounds, logos, signatures, custom fonts).
 * Actual file bytes live in Object Storage (R2/S3) or local disk in dev.
 */
export const assets = pgTable(
	'assets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
		kind: assetKindEnum('kind').notNull(),
		fileName: text('file_name').notNull(),
		mimeType: text('mime_type').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		storageKey: text('storage_key').notNull().unique(),
		publicUrl: text('public_url').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('assets_user_id_idx').on(table.userId),
		index('assets_project_id_idx').on(table.projectId)
	]
);

/**
 * Imported CSV or Excel rows for a project.
 * Preserves raw spreadsheet columns so users can remap properties anytime without a fresh upload.
 */
export const recipients = pgTable(
	'recipients',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		rowIndex: integer('row_index').notNull(),
		rawRow: jsonb('raw_row').$type<Record<string, string>>().notNull(),
		mappedData: jsonb('mapped_data').$type<Record<string, string>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [index('recipients_project_id_idx').on(table.projectId)]
);

/**
 * Individual generated certificates.
 * Every certificate exposes a dedicated Properties panel with its fields
 * (certName, recipientName, certTitle, role, ranking, email and custom properties).
 */
export const certificates = pgTable(
	'certificates',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		recipientId: text('recipient_id').references(() => recipients.id, { onDelete: 'set null' }),
		templateId: text('template_id')
			.notNull()
			.references(() => templates.id, { onDelete: 'restrict' }),
		certCode: text('cert_code').notNull(),
		// Explicit Properties section fields
		certName: text('cert_name').notNull(),
		recipientName: text('recipient_name').notNull(),
		certTitle: text('cert_title').notNull().default(''),
		role: text('role').notNull().default('Participant'),
		ranking: text('ranking').notNull().default(''),
		email: text('email'),
		customProperties: jsonb('custom_properties')
			.$type<Record<string, string>>()
			.notNull()
			.default({}),
		overrides: jsonb('overrides').$type<Record<string, unknown>>().notNull().default({}),
		emailStatus: certificateEmailStatusEnum('email_status').notNull().default('not_sent'),
		lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('certificates_project_code_idx').on(table.projectId, table.certCode),
		index('certificates_project_id_idx').on(table.projectId),
		index('certificates_template_id_idx').on(table.templateId),
		index('certificates_email_status_idx').on(table.projectId, table.emailStatus)
	]
);

/**
 * Bulk email dispatch jobs for a project.
 */
export const emailJobs = pgTable(
	'email_jobs',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		senderProfileId: text('sender_profile_id').references(() => senderProfiles.id, {
			onDelete: 'set null'
		}),
		senderEmailSnapshot: text('sender_email_snapshot').notNull(),
		subjectTemplate: text('subject_template').notNull(),
		bodyTemplate: text('body_template').notNull(),
		attachmentFormat: exportFormatEnum('attachment_format').$type<ExportFormat>().notNull().default('pdf'),
		status: emailJobStatusEnum('status').notNull().default('pending'),
		totalCount: integer('total_count').notNull().default(0),
		sentCount: integer('sent_count').notNull().default(0),
		failedCount: integer('failed_count').notNull().default(0),
		skippedNoEmailCount: integer('skipped_no_email_count').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(table) => [index('email_jobs_project_id_idx').on(table.projectId)]
);

/**
 * Per-certificate delivery audit log.
 */
export const emailLogs = pgTable(
	'email_logs',
	{
		id: text('id').primaryKey(),
		jobId: text('job_id')
			.notNull()
			.references(() => emailJobs.id, { onDelete: 'cascade' }),
		certificateId: text('certificate_id')
			.notNull()
			.references(() => certificates.id, { onDelete: 'cascade' }),
		toEmail: text('to_email').notNull(),
		status: text('status').notNull(), // 'sent' | 'failed'
		providerMessageId: text('provider_message_id'),
		errorMessage: text('error_message'),
		sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('email_logs_job_id_idx').on(table.jobId),
		index('email_logs_certificate_id_idx').on(table.certificateId)
	]
);

/**
 * Instance-wide key-value settings configured by administrators (for example, account quota limits).
 */
export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').$type<Record<string, unknown>>().notNull(),
	updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
