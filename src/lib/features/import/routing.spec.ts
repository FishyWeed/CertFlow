import { describe, expect, it } from 'vitest';
import { matchTemplateForRow, type RoutableTemplate } from './routing.ts';

const templates: RoutableTemplate[] = [
	{
		id: 'tpl-participant',
		name: 'Participant Certificate',
		assignedRoles: ['Participant'],
		rankingRule: { mode: 'any' },
		isDefault: true
	},
	{
		id: 'tpl-organiser',
		name: 'Organiser Certificate',
		assignedRoles: ['Organiser', 'Committee'],
		rankingRule: { mode: 'any' },
		isDefault: false
	},
	{
		id: 'tpl-winner',
		name: 'Winner Certificate',
		assignedRoles: ['Participant'],
		rankingRule: { mode: 'has_ranking' },
		isDefault: false
	},
	{
		id: 'tpl-champion',
		name: 'Champion Gold Certificate',
		assignedRoles: ['Participant'],
		rankingRule: { mode: 'specific_rankings', values: ['Champion'] },
		isDefault: false
	}
];

describe('matchTemplateForRow', () => {
	it('routes regular participants without ranking to Participant template', () => {
		const matched = matchTemplateForRow(templates, 'Participant', '');
		expect(matched?.id).toBe('tpl-participant');
	});

	it('routes organisers and committee members case-insensitively to the Organiser template', () => {
		expect(matchTemplateForRow(templates, 'organiser', '')?.id).toBe('tpl-organiser');
		expect(matchTemplateForRow(templates, 'Committee', '')?.id).toBe('tpl-organiser');
	});

	it('prioritises specific_rankings over has_ranking and generic role templates', () => {
		expect(matchTemplateForRow(templates, 'Participant', 'Champion')?.id).toBe('tpl-champion');
		expect(matchTemplateForRow(templates, 'Participant', '1st Runner Up')?.id).toBe('tpl-winner');
	});

	it('falls back to the project default template for unmapped roles', () => {
		expect(matchTemplateForRow(templates, 'Guest Speaker', '')?.id).toBe('tpl-participant');
	});

	it('matches templates using vertical property checklist filters', () => {
		const withChecklist: RoutableTemplate[] = [
			...templates,
			{
				id: 'tpl-apu',
				name: 'APU Special Certificate',
				assignedRoles: ['Participant'],
				rankingRule: {
					mode: 'any',
					propertyFilters: { role: ['Participant'], school: ['APU'] }
				},
				isDefault: false
			}
		];
		expect(
			matchTemplateForRow(withChecklist, 'Participant', '', { role: 'Participant', school: 'APU' })
				?.id
		).toBe('tpl-apu');
	});
});
