import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA } from '#lib/config/criteria.ts';
import {
	applyColumnMapping,
	autoMapHeaders,
	buildCsvExport,
	derivePropertiesFromHeaders
} from './parser.ts';

describe('spreadsheet header mapping', () => {
	it('auto-maps common spreadsheet column headers to built-in criteria', () => {
		const headers = ['Full Name', 'Category', 'Award', 'Contact Email'];
		const mapping = autoMapHeaders(headers, DEFAULT_CRITERIA);

		expect(mapping).toEqual({
			name: 'Full Name',
			role: 'Category',
			rank: 'Award',
			email: 'Contact Email'
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

	it('derives tag keys directly from every column name without alias remapping', () => {
		const { properties, mapping } = derivePropertiesFromHeaders([
			'Name',
			'Role',
			'Rank',
			'Award',
			'Student Name',
			'FIDE ID',
			'Email',
			'Category'
		]);

		expect(properties.map((p) => ({ key: p.key, label: p.label }))).toEqual([
			{ key: 'name', label: 'Name' },
			{ key: 'role', label: 'Role' },
			{ key: 'rank', label: 'Rank' },
			{ key: 'award', label: 'Award' },
			{ key: 'student_name', label: 'Student Name' },
			{ key: 'fide_id', label: 'FIDE ID' },
			{ key: 'email', label: 'Email' },
			{ key: 'category', label: 'Category' }
		]);
		expect(mapping).toEqual({
			name: 'Name',
			role: 'Role',
			rank: 'Rank',
			award: 'Award',
			student_name: 'Student Name',
			fide_id: 'FIDE ID',
			email: 'Email',
			category: 'Category'
		});
	});

	it('exports headers and rows into properly escaped CSV text', () => {
		const csv = buildCsvExport(
			['Name', 'Role', 'Ranking / Award', 'Email Address'],
			[
				{
					Name: 'Tan, Wei Ming',
					Role: 'Participant',
					'Ranking / Award': 'Champion "Open"',
					'Email Address': 'wei@example.com'
				},
				{
					Name: 'Aiman Hakim',
					Role: 'Organiser',
					'Ranking / Award': '',
					'Email Address': ''
				}
			]
		);

		expect(csv).toContain('Name,Role,Ranking / Award,Email Address');
		expect(csv).toContain('"Tan, Wei Ming",Participant,"Champion ""Open""",wei@example.com');
		expect(csv).toContain('Aiman Hakim,Organiser,,');
	});
});
