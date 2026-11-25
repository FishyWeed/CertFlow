import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA } from '#lib/config/criteria.ts';
import { applyColumnMapping, autoMapHeaders, derivePropertiesFromHeaders } from './parser.ts';

describe('spreadsheet header mapping', () => {
	it('auto-maps common spreadsheet column headers to built-in criteria', () => {
		const headers = ['Full Name', 'Category', 'Award', 'Contact Email', 'Tournament'];
		const mapping = autoMapHeaders(headers, DEFAULT_CRITERIA);

		expect(mapping).toEqual({
			name: 'Full Name',
			role: 'Category',
			rank: 'Award',
			email: 'Contact Email',
			title: 'Tournament'
		});
	});

	it('applies default event title and Participant role while leaving rank empty when blank', () => {
		const mapped = applyColumnMapping(
			{ 'Player Name': 'Benjamin Yap', Prize: '1st Runner Up' },
			{ name: 'Player Name', rank: 'Prize' },
			DEFAULT_CRITERIA,
			'21st Malaysian Chess Festival 2026'
		);

		expect(mapped.name).toBe('Benjamin Yap');
		expect(mapped.title).toBe('21st Malaysian Chess Festival 2026');
		expect(mapped.role).toBe('Participant');
		expect(mapped.rank).toBe('1st Runner Up');
		expect(mapped.email).toBe('');

		const unranked = applyColumnMapping(
			{ 'Player Name': 'Aiman Hakim', Prize: '' },
			{ name: 'Player Name', rank: 'Prize' },
			DEFAULT_CRITERIA,
			'21st Malaysian Chess Festival 2026'
		);
		expect(unranked.rank).toBe('');
	});

	it('derives properties directly from column headers with standard keys and custom slugs', () => {
		const { properties, mapping } = derivePropertiesFromHeaders([
			'Student Name',
			'School',
			'FIDE ID',
			'Role',
			'Email'
		]);

		expect(properties.map((p) => ({ key: p.key, label: p.label }))).toEqual([
			{ key: 'name', label: 'Student Name' },
			{ key: 'school', label: 'School' },
			{ key: 'fide_id', label: 'FIDE ID' },
			{ key: 'role', label: 'Role' },
			{ key: 'email', label: 'Email' }
		]);
		expect(mapping).toEqual({
			name: 'Student Name',
			school: 'School',
			fide_id: 'FIDE ID',
			role: 'Role',
			email: 'Email'
		});
	});
});
