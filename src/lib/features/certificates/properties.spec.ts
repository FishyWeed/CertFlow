import { describe, expect, it } from 'vitest';
import type { CriterionDefinition } from '#lib/types/certflow.ts';
import {
	buildCertificateFieldDefs,
	buildCertificateFilterOptions,
	buildCertificateRenderData,
	buildCertificateUpdateFromFields,
	computeFilterValuesForKey,
	EMPTY_FILTER_VALUE,
	extractCertificateFieldValues,
	filterCertificatesByKeyValue,
	pickDefaultFilterKey,
	TEMPLATE_FILTER_KEY,
	type CertificateLike
} from './properties.ts';

const customHeaders: CriterionDefinition[] = [
	{ key: 'full_name', label: 'Full Name', builtIn: false },
	{ key: 'position', label: 'Position', builtIn: false },
	{ key: 'department', label: 'Department', builtIn: false },
	{ key: 'award', label: 'Award', builtIn: false },
	{ key: 'email', label: 'Contact Email', builtIn: true }
];

const sampleCerts: CertificateLike[] = [
	{
		id: 'c1',
		templateId: 'tpl-1',
		certCode: 'CF-0001-AA',
		certName: 'Winner Cert',
		recipientName: 'Daniel Lim',
		certTitle: 'Annual Summit 2026',
		role: 'Arbiter',
		ranking: 'Champion',
		email: 'daniel@example.org',
		customProperties: {
			full_name: 'Daniel Lim',
			position: 'Arbiter',
			department: 'Operations',
			award: 'Gold'
		}
	},
	{
		id: 'c2',
		templateId: 'tpl-2',
		certCode: 'CF-0002-BB',
		certName: 'Staff Cert',
		recipientName: 'Aisha Huda',
		certTitle: 'Annual Summit 2026',
		role: 'Coordinator',
		ranking: '',
		email: null,
		customProperties: {
			full_name: 'Aisha Huda',
			position: 'Coordinator',
			department: 'Logistics',
			award: ''
		}
	}
];

describe('dynamic certificate table-header properties and filtering', () => {
	it('builds editable fields directly from project table headers in exact column order', () => {
		const fields = buildCertificateFieldDefs(customHeaders, sampleCerts[0]);
		expect(fields.map((f) => f.label)).toEqual([
			'Full Name',
			'Position',
			'Department',
			'Award',
			'Contact Email'
		]);
		expect(fields.find((f) => f.key === 'email')?.isEmail).toBe(true);

		const values = extractCertificateFieldValues(sampleCerts[0], fields);
		expect(values).toEqual({
			full_name: 'Daniel Lim',
			position: 'Arbiter',
			department: 'Operations',
			award: 'Gold',
			email: 'daniel@example.org'
		});
	});

	it('updates customProperties and aliased standard columns cleanly on save', () => {
		const fields = buildCertificateFieldDefs(customHeaders, sampleCerts[0]);
		const patch = buildCertificateUpdateFromFields(
			sampleCerts[0],
			fields,
			{
				full_name: 'Daniel Lim Sheng Wei',
				position: 'Chief Arbiter',
				department: 'Technical',
				award: 'Platinum',
				email: 'chief@example.org'
			},
			'tpl-1',
			'Winner Cert'
		);

		expect(patch.recipientName).toBe('Daniel Lim Sheng Wei');
		expect(patch.role).toBe('Chief Arbiter');
		expect(patch.email).toBe('chief@example.org');
		expect(patch.customProperties).toEqual({
			full_name: 'Daniel Lim Sheng Wei',
			position: 'Chief Arbiter',
			department: 'Technical',
			award: 'Platinum'
		});

		const renderMap = buildCertificateRenderData(patch);
		expect(renderMap.department).toBe('Technical');
		expect(renderMap.award).toBe('Platinum');
		expect(renderMap.position).toBe('Chief Arbiter');
	});

	it('builds filter options from table headers and filters by any column including empty values and templates', () => {
		const templateNames = new Map([
			['tpl-1', 'Winner Cert'],
			['tpl-2', 'Staff Cert']
		]);

		const options = buildCertificateFilterOptions(customHeaders, sampleCerts);
		expect(options.map((o) => o.label)).toEqual([
			'Full Name',
			'Position',
			'Department',
			'Award',
			'Contact Email',
			'Template'
		]);

		// Prefers the role-aliased table header ("position") by default
		expect(pickDefaultFilterKey(options, sampleCerts)).toBe('position');

		// Filtering by custom column "department"
		const deptValues = computeFilterValuesForKey(sampleCerts, 'department', templateNames);
		expect(deptValues).toEqual([
			{ value: 'Logistics', label: 'Logistics', count: 1 },
			{ value: 'Operations', label: 'Operations', count: 1 }
		]);
		expect(
			filterCertificatesByKeyValue(sampleCerts, 'department', 'Operations', templateNames).map(
				(c) => c.id
			)
		).toEqual(['c1']);

		// Filtering by column with blank entries includes "(Empty)"
		const awardValues = computeFilterValuesForKey(sampleCerts, 'award', templateNames);
		expect(awardValues).toEqual([
			{ value: 'Gold', label: 'Gold', count: 1 },
			{ value: EMPTY_FILTER_VALUE, label: '(Empty)', count: 1 }
		]);
		expect(
			filterCertificatesByKeyValue(sampleCerts, 'award', EMPTY_FILTER_VALUE, templateNames).map(
				(c) => c.id
			)
		).toEqual(['c2']);

		// Filtering by Template works cleanly
		const tplValues = computeFilterValuesForKey(sampleCerts, TEMPLATE_FILTER_KEY, templateNames);
		expect(tplValues).toHaveLength(2);
		expect(
			filterCertificatesByKeyValue(sampleCerts, TEMPLATE_FILTER_KEY, 'Staff Cert', templateNames).map(
				(c) => c.id
			)
		).toEqual(['c2']);
	});
});
