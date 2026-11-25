export const EMPTY_CATEGORY = '__empty__';
export const TEMPLATE_COLUMN_KEY = '__matched_template__';

export interface TableSort {
	column: string;
	direction: 'asc' | 'desc';
}

export interface CategoryOption {
	key: string;
	label: string;
	count: number;
}

export interface IndexedRow {
	originalIndex: number;
	row: Record<string, string>;
	matchedTemplate: string;
}

/**
 * Returns a new array with the item at `fromIndex` moved to `toIndex`.
 */
export function reorderArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
	if (
		fromIndex === toIndex ||
		fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex >= items.length ||
		toIndex >= items.length
	) {
		return [...items];
	}
	const next = [...items];
	const [moved] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, moved);
	return next;
}

function getRowColumnValue(
	row: Record<string, string>,
	matchedTemplate: string,
	column: string
): string {
	if (column === TEMPLATE_COLUMN_KEY) {
		return matchedTemplate.trim();
	}
	return (row[column] ?? '').trim();
}

/**
 * Collects distinct categories and row counts for a column (or Matched Template).
 * Empty cells are grouped under `EMPTY_CATEGORY` and listed last.
 */
export function getColumnCategories(
	rows: Record<string, string>[],
	matchedTemplates: string[],
	column: string
): CategoryOption[] {
	const counts = new Map<string, { label: string; count: number }>();

	for (let i = 0; i < rows.length; i++) {
		const raw = getRowColumnValue(rows[i], matchedTemplates[i] ?? 'Unassigned', column);
		const key = raw === '' ? EMPTY_CATEGORY : raw.toLowerCase();
		const existing = counts.get(key);
		if (existing) {
			existing.count += 1;
		} else {
			counts.set(key, {
				label: raw === '' ? '(Empty)' : raw,
				count: 1
			});
		}
	}

	const options: CategoryOption[] = Array.from(counts.entries()).map(([key, info]) => ({
		key,
		label: info.label,
		count: info.count
	}));

	options.sort((a, b) => {
		if (a.key === EMPTY_CATEGORY) return 1;
		if (b.key === EMPTY_CATEGORY) return -1;
		return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
	});

	return options;
}

/**
 * Filters rows by global search and per-column category selections, then applies optional sorting.
 * Preserves each row's `originalIndex` so inline edits and deletes target the exact underlying row.
 */
export function filterAndSortRows(
	rows: Record<string, string>[],
	matchedTemplates: string[],
	options: {
		search: string;
		categoryFilters: Record<string, string[]>;
		sort: TableSort | null;
	}
): IndexedRow[] {
	const query = options.search.trim().toLowerCase();
	const activeFilters = Object.entries(options.categoryFilters).filter(
		([, selected]) => selected.length > 0
	);

	let result: IndexedRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const matchedTemplate = matchedTemplates[i] ?? 'Unassigned';

		if (query) {
			const matchesCell = Object.values(row).some((val) => val.toLowerCase().includes(query));
			const matchesTpl = matchedTemplate.toLowerCase().includes(query);
			if (!matchesCell && !matchesTpl) continue;
		}

		let categoryOk = true;
		for (const [col, selectedKeys] of activeFilters) {
			const val = getRowColumnValue(row, matchedTemplate, col);
			const key = val === '' ? EMPTY_CATEGORY : val.toLowerCase();
			if (!selectedKeys.includes(key)) {
				categoryOk = false;
				break;
			}
		}
		if (!categoryOk) continue;

		result.push({ originalIndex: i, row, matchedTemplate });
	}

	if (options.sort) {
		const { column, direction } = options.sort;
		const mult = direction === 'asc' ? 1 : -1;
		result = [...result].sort((a, b) => {
			const va = getRowColumnValue(a.row, a.matchedTemplate, column);
			const vb = getRowColumnValue(b.row, b.matchedTemplate, column);
			if (va === '' && vb === '') return a.originalIndex - b.originalIndex;
			if (va === '') return 1;
			if (vb === '') return -1;
			const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
			return cmp !== 0 ? cmp * mult : a.originalIndex - b.originalIndex;
		});
	}

	return result;
}
