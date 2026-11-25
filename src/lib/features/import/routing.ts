import type { TemplateRankingRule } from '#lib/types/certflow.ts';

export interface RoutableTemplate {
	id: string;
	name: string;
	assignedRoles: string[];
	rankingRule: TemplateRankingRule;
	isDefault: boolean;
}

function norm(value: string | undefined): string {
	return (value ?? '').trim().toLowerCase();
}

function matchesRankingRule(ranking: string, rule: TemplateRankingRule | undefined): boolean {
	const cleaned = norm(ranking);
	const mode = rule?.mode ?? 'any';

	if (mode === 'any') return true;
	if (mode === 'has_ranking') return cleaned.length > 0;
	if (mode === 'no_ranking') return cleaned.length === 0;
	if (mode === 'specific_rankings') {
		const allowed = (rule?.values ?? []).map(norm).filter(Boolean);
		return cleaned.length > 0 && allowed.includes(cleaned);
	}
	return true;
}

function matchesPropertyFilters(
	rowData: Record<string, string>,
	filters: Record<string, string[]> | undefined
): boolean {
	if (!filters) return true;
	for (const [key, allowedRaw] of Object.entries(filters)) {
		const rawVal =
			key === 'rank'
				? (rowData.rank ?? rowData.ranking)
				: key === 'ranking'
					? (rowData.ranking ?? rowData.rank)
					: rowData[key];
		const cellVal = norm(rawVal);
		const allowed = allowedRaw.map(norm).filter(Boolean);
		if (allowed.length === 0) {
			if (!cellVal) return false;
		} else if (!allowed.includes(cellVal)) {
			return false;
		}
	}
	return true;
}

function ruleSpecificity(tpl: RoutableTemplate): number {
	let score = tpl.assignedRoles.length > 0 ? 1 : 0;
	const mode = tpl.rankingRule?.mode ?? 'any';
	if (mode === 'specific_rankings') score += 3;
	else if (mode === 'has_ranking' || mode === 'no_ranking') score += 2;
	else score += 1;

	const filters = tpl.rankingRule?.propertyFilters;
	if (filters) {
		for (const vals of Object.values(filters)) {
			score += vals.length > 0 ? 3 : 2;
		}
	}
	return score;
}

/**
 * Selects the best certificate template for a recipient row using role, ranking and property checklist filters.
 * More specific templates win over generic templates; unmatched rows fall back to the project default.
 */
export function matchTemplateForRow<T extends RoutableTemplate>(
	templates: T[],
	role: string,
	ranking: string,
	rowData?: Record<string, string>
): T | null {
	if (templates.length === 0) return null;

	const targetRole = norm(role);
	const effectiveRank = rowData?.rank ?? rowData?.ranking ?? ranking;
	const mergedData: Record<string, string> = {
		...(rowData ?? {}),
		role: rowData?.role ?? role,
		rank: effectiveRank,
		ranking: effectiveRank
	};

	const matches = templates
		.filter((tpl) => {
			const hasRoleConstraint = tpl.assignedRoles.length > 0;
			const roleOk = !hasRoleConstraint || tpl.assignedRoles.map(norm).includes(targetRole);
			const rankingOk = matchesRankingRule(effectiveRank, tpl.rankingRule);
			const propsOk = matchesPropertyFilters(mergedData, tpl.rankingRule?.propertyFilters);
			// Require at least one explicit constraint to actively match before falling back to default.
			const hasAnyConstraint =
				hasRoleConstraint ||
				(tpl.rankingRule?.mode ?? 'any') !== 'any' ||
				Object.keys(tpl.rankingRule?.propertyFilters ?? {}).length > 0;
			return hasAnyConstraint && roleOk && rankingOk && propsOk;
		})
		.sort((a, b) => ruleSpecificity(b) - ruleSpecificity(a));

	if (matches[0]) return matches[0];

	const fallback = templates.find((tpl) => tpl.isDefault) ?? templates[0];
	return fallback ?? null;
}
