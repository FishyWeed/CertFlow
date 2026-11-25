import { describe, expect, it } from 'vitest';
import {
	EMPTY_CATEGORY,
	TEMPLATE_COLUMN_KEY,
	filterAndSortRows,
	getColumnCategories,
	reorderArray
} from './table-ops.ts';

const rows = [
	{ Name: 'Benjamin Yap Jun Hong', Role: 'Participant', Rank: 'Champion' },
	{ Name: 'John Doe', Role: 'Arbiter', Rank: '' },
	{ Name: 'Jane Doe', Role: 'Participant', Rank: '1st Runner Up' },
	{ Name: 'Harry Kane', Role: 'Participant', Rank: '2nd Runner Up' }
];
const templates = ['Participant', 'Arbiter', 'Participant', 'Participant'];

describe('table-ops', () => {
	it('reorders items without mutating the source array', () => {
		const orig = ['Name', 'Role', 'Rank', 'Email'];
		const next = reorderArray(orig, 2, 0);
		expect(next).toEqual(['Rank', 'Name', 'Role', 'Email']);
		expect(orig).toEqual(['Name', 'Role', 'Rank', 'Email']);
	});

	it('collects distinct categories with counts and places empty last', () => {
		const cats = getColumnCategories(rows, templates, 'Rank');
		expect(cats.map((c) => [c.label, c.count])).toEqual([
			['1st Runner Up', 1],
			['2nd Runner Up', 1],
			['Champion', 1],
			['(Empty)', 1]
		]);
		expect(cats.at(-1)?.key).toBe(EMPTY_CATEGORY);
	});

	it('searches across all columns and matched template while preserving originalIndex', () => {
		const filtered = filterAndSortRows(rows, templates, {
			search: 'arbiter',
			categoryFilters: {},
			sort: null
		});
		expect(filtered).toHaveLength(1);
		expect(filtered[0].originalIndex).toBe(1);
		expect(filtered[0].row.Name).toBe('John Doe');
	});

	it('filters by column category including empty values and matched template', () => {
		const emptyRank = filterAndSortRows(rows, templates, {
			search: '',
			categoryFilters: { Rank: [EMPTY_CATEGORY] },
			sort: null
		});
		expect(emptyRank.map((r) => r.row.Name)).toEqual(['John Doe']);

		const participants = filterAndSortRows(rows, templates, {
			search: '',
			categoryFilters: { [TEMPLATE_COLUMN_KEY]: ['participant'] },
			sort: null
		});
		expect(participants.map((r) => r.originalIndex)).toEqual([0, 2, 3]);
	});

	it('sorts A-Z and Z-A while keeping empty cells at the bottom', () => {
		const asc = filterAndSortRows(rows, templates, {
			search: '',
			categoryFilters: {},
			sort: { column: 'Name', direction: 'asc' }
		});
		expect(asc.map((r) => r.row.Name)).toEqual([
			'Benjamin Yap Jun Hong',
			'Harry Kane',
			'Jane Doe',
			'John Doe'
		]);

		const rankDesc = filterAndSortRows(rows, templates, {
			search: '',
			categoryFilters: {},
			sort: { column: 'Rank', direction: 'desc' }
		});
		expect(rankDesc.map((r) => r.row.Name)).toEqual([
			'Benjamin Yap Jun Hong',
			'Harry Kane',
			'Jane Doe',
			'John Doe'
		]);
	});
});
