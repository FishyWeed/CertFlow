import { describe, expect, it } from 'vitest';
import {
	MAX_PROJECTS_PER_USER,
	MAX_RECIPIENTS_PER_PROJECT,
	MAX_STORAGE_BYTES_PER_USER,
	MAX_UPLOAD_BYTES
} from '#lib/config/limits.ts';
import {
	getDefaultQuotaLimits,
	MB,
	normaliseStoredQuotaLimits,
	parseAdminEmailAllowlist,
	quotaLimitsInputSchema
} from './app-settings.ts';

describe('admin quota settings helpers', () => {
	it('returns unlimited defaults for local runtimes and guarded defaults for hosted deployments', () => {
		expect(getDefaultQuotaLimits(true)).toEqual({
			maxProjectsPerUser: null,
			maxStorageBytesPerUser: null,
			maxUploadBytes: null,
			maxRecipientsPerProject: null
		});

		expect(getDefaultQuotaLimits(false)).toEqual({
			maxProjectsPerUser: MAX_PROJECTS_PER_USER,
			maxStorageBytesPerUser: MAX_STORAGE_BYTES_PER_USER,
			maxUploadBytes: MAX_UPLOAD_BYTES,
			maxRecipientsPerProject: MAX_RECIPIENTS_PER_PROJECT
		});
	});

	it('validates custom limits and explicit null (no limit) values cleanly', () => {
		const custom = quotaLimitsInputSchema.parse({
			maxProjectsPerUser: 25,
			maxStorageBytesPerUser: 100 * MB,
			maxUploadBytes: 20 * MB,
			maxRecipientsPerProject: 10_000
		});
		expect(custom.maxProjectsPerUser).toBe(25);
		expect(custom.maxStorageBytesPerUser).toBe(100 * MB);

		const unlimited = quotaLimitsInputSchema.parse({
			maxProjectsPerUser: null,
			maxStorageBytesPerUser: null,
			maxUploadBytes: null,
			maxRecipientsPerProject: null
		});
		expect(unlimited).toEqual({
			maxProjectsPerUser: null,
			maxStorageBytesPerUser: null,
			maxUploadBytes: null,
			maxRecipientsPerProject: null
		});

		expect(() =>
			quotaLimitsInputSchema.parse({
				maxProjectsPerUser: 0,
				maxStorageBytesPerUser: 30 * MB,
				maxUploadBytes: 10 * MB,
				maxRecipientsPerProject: 5000
			})
		).toThrow();
	});

	it('normalises partial or malformed stored JSON safely back to defaults while preserving null', () => {
		const defaults = getDefaultQuotaLimits(false);
		const normalised = normaliseStoredQuotaLimits(
			{
				maxProjectsPerUser: null,
				maxStorageBytesPerUser: 250 * MB,
				maxUploadBytes: -5,
				maxRecipientsPerProject: 'invalid'
			},
			defaults
		);

		expect(normalised).toEqual({
			maxProjectsPerUser: null,
			maxStorageBytesPerUser: 250 * MB,
			maxUploadBytes: MAX_UPLOAD_BYTES,
			maxRecipientsPerProject: MAX_RECIPIENTS_PER_PROJECT
		});
	});

	it('parses comma-separated ADMIN_EMAILS case-insensitively', () => {
		const set = parseAdminEmailAllowlist(' Admin@Example.org , owner@certflow.app ,, ');
		expect(set.has('admin@example.org')).toBe(true);
		expect(set.has('owner@certflow.app')).toBe(true);
		expect(set.size).toBe(2);
	});
});
