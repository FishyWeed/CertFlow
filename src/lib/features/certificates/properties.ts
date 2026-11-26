import { CRITERION_HEADER_ALIASES } from '#lib/config/criteria.ts';
import { slugifyHeaderToKey } from '#lib/features/import/parser.ts';
import type { CriterionDefinition } from '#lib/types/certflow.ts';

export interface CertificateLike {
	id: string;
	templateId: string;
	certCode: string;
	certName: string;
	recipientName: string;
	certTitle: string;
	role: string;
	ranking: string;
	email: string | null;
	customProperties: Record<string, string>;
}

export interface CertificateFieldDef {
	key: string;
	label: string;
	isEmail: boolean;
	isRequired: boolean;
}

export interface CertificateFilterOption {
	key: string;
	label: string;
}

export interface CertificateFilterValue {
	value: string;
	label: string;
	count: number;
}

export const TEMPLATE_FILTER_KEY = '__template__';
export const EMPTY_FILTER_VALUE = '__empty__';

const STANDARD_KEYS = new Set(['name', 'title', 'role', 'rank', 'ranking', 'email']);

const ALIAS_SLUGS: Record<'name' | 'title' | 'role' | 'rank' | 'email', Set<string>> = {
	name: new Set(['name', ...(CRITERION_HEADER_ALIASES.name ?? []).map(slugifyHeaderToKey)]),
	title: new Set(['title', ...(CRITERION_HEADER_ALIASES.title ?? []).map(slugifyHeaderToKey)]),
	role: new Set(['role', ...(CRITERION_HEADER_ALIASES.role ?? []).map(slugifyHeaderToKey)]),
	rank: new Set([
		'rank',
		'ranking',
		...(CRITERION_HEADER_ALIASES.rank ?? []).map(slugifyHeaderToKey)
	]),
	email: new Set(['email', ...(CRITERION_HEADER_ALIASES.email ?? []).map(slugifyHeaderToKey)])
};

export function isEmailFieldKey(key: string): boolean {
	return ALIAS_SLUGS.email.has(key);
}

export function isNameFieldKey(key: string): boolean {
	return ALIAS_SLUGS.name.has(key);
}

/**
 * Builds the ordered list of editable certificate fields directly from the project's table headers
 * (`criteriaConfig`), plus any leftover custom property keys present on the certificate itself.
 */
export function buildCertificateFieldDefs(
	criteriaConfig: CriterionDefinition[],
	certificate?: Pick<CertificateLike, 'customProperties'> | null
): CertificateFieldDef[] {
	const defs: CertificateFieldDef[] = [];
	const seen = new Set<string>();

	for (const prop of criteriaConfig ?? []) {
		const key = prop.key.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		defs.push({
			key,
			label: prop.label.trim() || key,
			isEmail: isEmailFieldKey(key),
			isRequired: Boolean(prop.required) || key === 'name'
		});
	}

	if (certificate?.customProperties) {
		for (const rawKey of Object.keys(certificate.customProperties)) {
			if (!rawKey || seen.has(rawKey)) continue;
			seen.add(rawKey);
			const pretty = rawKey
				.replace(/[_-]+/g, ' ')
				.replace(/\b\w/g, (ch) => ch.toUpperCase());
			defs.push({
				key: rawKey,
				label: pretty,
				isEmail: isEmailFieldKey(rawKey),
				isRequired: false
			});
		}
	}

	return defs;
}

/**
 * Reads a table header's value from a certificate record (handling both standard DB columns
 * and customProperties transparently).
 */
export function readCertificateFieldValue(cert: CertificateLike, key: string): string {
	if (key === 'name') return cert.recipientName;
	if (key === 'title') return cert.certTitle;
	if (key === 'role') return cert.role;
	if (key === 'rank' || key === 'ranking') return cert.ranking;
	if (key === 'email') return cert.email ?? '';
	if (cert.customProperties && key in cert.customProperties) {
		return cert.customProperties[key] ?? '';
	}
	if (ALIAS_SLUGS.name.has(key)) return cert.recipientName;
	if (ALIAS_SLUGS.title.has(key)) return cert.certTitle;
	if (ALIAS_SLUGS.role.has(key)) return cert.role;
	if (ALIAS_SLUGS.rank.has(key)) return cert.ranking;
	if (ALIAS_SLUGS.email.has(key)) return cert.email ?? '';
	return '';
}

/**
 * Builds the initial map of field key -> string value for all active table headers on a certificate.
 */
export function extractCertificateFieldValues(
	cert: CertificateLike,
	fields: CertificateFieldDef[]
): Record<string, string> {
	const values: Record<string, string> = {};
	for (const field of fields) {
		values[field.key] = readCertificateFieldValue(cert, field.key);
	}
	return values;
}

/**
 * Combines edited table-header field values with the existing certificate record into a PATCH
 * payload and live preview data map. Keeps standard DB columns and customProperties in sync.
 */
export function buildCertificateUpdateFromFields(
	cert: CertificateLike,
	fields: CertificateFieldDef[],
	fieldValues: Record<string, string>,
	templateId: string,
	certName: string
): {
	templateId: string;
	certName: string;
	recipientName: string;
	certTitle: string;
	role: string;
	ranking: string;
	email: string | null;
	customProperties: Record<string, string>;
} {
	let recipientName = cert.recipientName;
	let certTitle = cert.certTitle;
	let role = cert.role;
	let ranking = cert.ranking;
	let email: string | null = cert.email;
	const customProperties: Record<string, string> = { ...(cert.customProperties ?? {}) };

	for (const field of fields) {
		const raw = (fieldValues[field.key] ?? '').trim();
		const key = field.key;

		if (key === 'name') {
			recipientName = raw || cert.recipientName;
		} else if (key === 'title') {
			certTitle = raw;
		} else if (key === 'role') {
			role = raw;
		} else if (key === 'rank' || key === 'ranking') {
			ranking = raw;
		} else if (key === 'email') {
			email = raw || null;
		} else {
			if (raw) {
				customProperties[key] = raw;
			} else {
				delete customProperties[key];
			}
			// Keep aliased core columns aligned so list labels, routing and email sending stay accurate.
			if (ALIAS_SLUGS.name.has(key) && raw) recipientName = raw;
			else if (ALIAS_SLUGS.title.has(key)) certTitle = raw;
			else if (ALIAS_SLUGS.role.has(key)) role = raw;
			else if (ALIAS_SLUGS.rank.has(key)) ranking = raw;
			else if (ALIAS_SLUGS.email.has(key)) email = raw || null;
		}
	}

	return {
		templateId,
		certName: certName.trim() || cert.certName,
		recipientName: recipientName.trim() || cert.recipientName,
		certTitle,
		role,
		ranking,
		email,
		customProperties
	};
}

/**
 * Builds the flat placeholder interpolation map used by the live certificate preview and exporter.
 */
export function buildCertificateRenderData(cert: {
	recipientName: string;
	certTitle: string;
	role: string;
	ranking: string;
	email: string | null;
	customProperties?: Record<string, string>;
}): Record<string, string> {
	return {
		name: cert.recipientName,
		title: cert.certTitle,
		role: cert.role,
		rank: cert.ranking,
		ranking: cert.ranking,
		email: cert.email ?? '',
		...(cert.customProperties ?? {})
	};
}

/**
 * Lists every filterable table header (from `criteriaConfig`) plus a Template filter option.
 */
export function buildCertificateFilterOptions(
	criteriaConfig: CriterionDefinition[],
	certificates: CertificateLike[]
): CertificateFilterOption[] {
	const options: CertificateFilterOption[] = [];
	const seen = new Set<string>();

	for (const prop of criteriaConfig ?? []) {
		const key = prop.key.trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		options.push({ key, label: prop.label.trim() || key });
	}

	for (const cert of certificates) {
		for (const key of Object.keys(cert.customProperties ?? {})) {
			if (!key || seen.has(key)) continue;
			seen.add(key);
			const pretty = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
			options.push({ key, label: pretty });
		}
	}

	options.push({ key: TEMPLATE_FILTER_KEY, label: 'Template' });
	return options;
}

/**
 * Chooses the best initial table header for the filter bar: prefers a role-like header,
 * then the first categorical non-name/non-email header, then Template.
 */
export function pickDefaultFilterKey(
	options: CertificateFilterOption[],
	certificates: CertificateLike[]
): string {
	const roleOption = options.find((o) => ALIAS_SLUGS.role.has(o.key));
	if (roleOption) return roleOption.key;

	const categorical = options.find(
		(o) =>
			o.key !== TEMPLATE_FILTER_KEY &&
			!ALIAS_SLUGS.name.has(o.key) &&
			!ALIAS_SLUGS.email.has(o.key) &&
			certificates.some((c) => readCertificateFieldValue(c, o.key).trim().length > 0)
	);
	if (categorical) return categorical.key;

	const nonUnique = options.find(
		(o) =>
			o.key !== TEMPLATE_FILTER_KEY &&
			!ALIAS_SLUGS.name.has(o.key) &&
			!ALIAS_SLUGS.email.has(o.key)
	);
	return nonUnique?.key ?? options[0]?.key ?? TEMPLATE_FILTER_KEY;
}

/**
 * Computes sorted distinct values and counts for the currently selected table header (or Template).
 */
export function computeFilterValuesForKey(
	certificates: CertificateLike[],
	filterKey: string,
	templateNameById: Map<string, string>
): CertificateFilterValue[] {
	const counts = new Map<string, number>();
	let emptyCount = 0;

	for (const cert of certificates) {
		const raw =
			filterKey === TEMPLATE_FILTER_KEY
				? (templateNameById.get(cert.templateId) ?? cert.certName).trim()
				: readCertificateFieldValue(cert, filterKey).trim();
		if (!raw) {
			emptyCount += 1;
		} else {
			counts.set(raw, (counts.get(raw) ?? 0) + 1);
		}
	}

	const values: CertificateFilterValue[] = Array.from(counts.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([value, count]) => ({ value, label: value, count }));

	if (emptyCount > 0) {
		values.push({ value: EMPTY_FILTER_VALUE, label: '(Empty)', count: emptyCount });
	}

	return values;
}

/**
 * Filters certificates by the selected table header (or Template) and value.
 */
export function filterCertificatesByKeyValue<T extends CertificateLike>(
	certificates: T[],
	filterKey: string,
	filterValue: string,
	templateNameById: Map<string, string>
): T[] {
	if (filterValue === 'all') return certificates;

	return certificates.filter((cert) => {
		const raw =
			filterKey === TEMPLATE_FILTER_KEY
				? (templateNameById.get(cert.templateId) ?? cert.certName).trim()
				: readCertificateFieldValue(cert, filterKey).trim();
		if (filterValue === EMPTY_FILTER_VALUE) {
			return raw.length === 0;
		}
		return raw === filterValue;
	});
}

export function isStandardCertificateKey(key: string): boolean {
	return STANDARD_KEYS.has(key);
}
