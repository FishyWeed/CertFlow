import type { CriterionDefinition } from '#lib/types/certflow.ts';

// Built-in properties shared across table headers, template {{placeholders}} and certificate Properties.
export const DEFAULT_CRITERIA: CriterionDefinition[] = [
	{ key: 'name', label: 'Name', builtIn: true, required: true },
	{ key: 'role', label: 'Role', builtIn: true, defaultValue: 'Participant' },
	{ key: 'rank', label: 'Rank', builtIn: true },
	{ key: 'email', label: 'Email', builtIn: true }
];

// Normalised header aliases used to detect spreadsheet columns during CSV or Excel import.
export const CRITERION_HEADER_ALIASES: Record<string, string[]> = {
	name: ['name', 'full name', 'fullname', 'participant', 'participant name', 'recipient', 'recipient name', 'student name', 'player'],
	title: ['title', 'cert title', 'certificate title', 'event', 'event name', 'event title', 'competition', 'tournament'],
	role: ['role', 'position', 'category', 'type', 'group', 'designation', 'committee'],
	rank: ['rank', 'ranking', 'award', 'ranking / award', 'prize', 'placement', 'result', 'standing', 'achievement', 'position won'],
	email: ['email', 'e-mail', 'email address', 'mail', 'recipient email', 'contact email']
};
