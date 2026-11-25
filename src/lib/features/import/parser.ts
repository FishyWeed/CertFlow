import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { CRITERION_HEADER_ALIASES } from '#lib/config/criteria.ts';
import type { ColumnMapping, CriterionDefinition } from '#lib/types/certflow.ts';

export interface ParsedSpreadsheet {
	fileName: string;
	headers: string[];
	rows: Record<string, string>[];
}

function normalizeHeader(header: string): string {
	return header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function slugifyHeaderToKey(header: string): string {
	return (
		header
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '') || 'property'
	);
}

/**
 * Turns table column headers directly into project Properties and a 1:1 column mapping.
 * Recognised built-in aliases keep standard keys (name, title, role, ranking, email) so
 * starter templates and email sending work automatically; all other headers become {{slug}} keys.
 */
export function derivePropertiesFromHeaders(headers: string[]): {
	properties: CriterionDefinition[];
	mapping: ColumnMapping;
} {
	const properties: CriterionDefinition[] = [];
	const mapping: ColumnMapping = {};
	const usedKeys = new Set<string>();

	const builtInAliasLookup = new Map<string, string>();
	for (const [key, aliases] of Object.entries(CRITERION_HEADER_ALIASES)) {
		builtInAliasLookup.set(key, key);
		for (const alias of aliases) {
			builtInAliasLookup.set(normalizeHeader(alias), key);
		}
	}

	for (const rawHeader of headers) {
		const label = rawHeader.trim();
		if (!label) continue;

		const norm = normalizeHeader(label);
		const matchedBuiltIn = builtInAliasLookup.get(norm);

		const baseKey =
			matchedBuiltIn && !usedKeys.has(matchedBuiltIn)
				? matchedBuiltIn
				: slugifyHeaderToKey(label);

		let key = baseKey;
		let suffix = 2;
		while (usedKeys.has(key)) {
			key = `${baseKey}_${suffix++}`;
		}

		usedKeys.add(key);
		const isBuiltIn = Boolean(matchedBuiltIn && key === matchedBuiltIn);
		properties.push({
			key,
			label,
			builtIn: isBuiltIn,
			required: key === 'name' ? true : undefined,
			defaultValue: key === 'role' ? 'Participant' : undefined
		});
		mapping[key] = rawHeader;
	}

	return { properties, mapping };
}

function cleanRow(raw: Record<string, unknown>, headers: string[]): Record<string, string> {
	const cleaned: Record<string, string> = {};
	for (const header of headers) {
		const val = raw[header];
		cleaned[header] = val == null ? '' : String(val).trim();
	}
	return cleaned;
}

/**
 * Parses a CSV, XLSX or XLS File into normalised string rows and header names.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

	if (ext === 'csv' || file.type === 'text/csv') {
		const text = await file.text();
		const parsed = Papa.parse<Record<string, unknown>>(text, {
			header: true,
			skipEmptyLines: 'greedy'
		});
		const headers = (parsed.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);
		const rows = parsed.data
			.map((row) => cleanRow(row, headers))
			.filter((row) => Object.values(row).some((val) => val !== ''));
		return { fileName: file.name, headers, rows };
	}

	const buffer = await file.arrayBuffer();
	const workbook = XLSX.read(buffer, { type: 'array' });
	const firstSheetName = workbook.SheetNames[0];
	if (!firstSheetName) {
		return { fileName: file.name, headers: [], rows: [] };
	}
	const sheet = workbook.Sheets[firstSheetName];
	const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
	const headerSet = new Set<string>();
	for (const row of rawRows) {
		for (const key of Object.keys(row)) {
			if (key.trim()) headerSet.add(key);
		}
	}
	const headers = Array.from(headerSet);
	const rows = rawRows
		.map((row) => cleanRow(row, headers))
		.filter((row) => Object.values(row).some((val) => val !== ''));

	return { fileName: file.name, headers, rows };
}

/**
 * Maps spreadsheet headers to project properties with known aliases and exact matches.
 * Users can change any mapping manually afterwards.
 */
export function autoMapHeaders(
	headers: string[],
	criteria: CriterionDefinition[]
): ColumnMapping {
	const mapping: ColumnMapping = {};
	const usedHeaders = new Set<string>();

	for (const criterion of criteria) {
		const aliases = new Set<string>([
			normalizeHeader(criterion.key),
			normalizeHeader(criterion.label),
			...(CRITERION_HEADER_ALIASES[criterion.key] ?? [])
		]);

		const exactMatch = headers.find(
			(h) => !usedHeaders.has(h) && aliases.has(normalizeHeader(h))
		);
		if (exactMatch) {
			mapping[criterion.key] = exactMatch;
			usedHeaders.add(exactMatch);
		}
	}

	return mapping;
}

/**
 * Projects a raw spreadsheet row into criterion key -> value pairs using the active column mapping.
 */
export function applyColumnMapping(
	rawRow: Record<string, string>,
	mapping: ColumnMapping,
	criteria: CriterionDefinition[],
	defaultCertTitle: string
): Record<string, string> {
	const mapped: Record<string, string> = {};
	for (const criterion of criteria) {
		const columnHeader = mapping[criterion.key];
		const rawVal = columnHeader ? (rawRow[columnHeader] ?? '').trim() : '';

		if (rawVal) {
			mapped[criterion.key] = rawVal;
		} else if (criterion.key === 'title' && defaultCertTitle) {
			mapped[criterion.key] = defaultCertTitle;
		} else if (criterion.key === 'role') {
			mapped[criterion.key] = criterion.defaultValue ?? 'Participant';
		} else {
			mapped[criterion.key] = '';
		}
	}
	if (!mapped.title && defaultCertTitle) {
		mapped.title = defaultCertTitle;
	}
	return mapped;
}

/**
 * Serialises table headers and rows into an RFC-4180 CSV string with proper quoting.
 */
export function buildCsvExport(headers: string[], rows: Record<string, string>[]): string {
	return Papa.unparse({
		fields: headers,
		data: rows.map((row) => headers.map((header) => row[header] ?? ''))
	});
}
