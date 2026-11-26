export interface WorkspaceTab {
	id: 'editor' | 'data' | 'certificates' | 'email' | 'settings';
	label: string;
	segment: string;
	dotClass: string;
	accentClass: string;
}

// Press & Signal four-stage architectural pigments:
// Editor (Blueprint Cobalt), Data (Verdigris Jade), Certificates (Burnished Ochre), Email (Cerulean Dispatch).
export const PROJECT_WORKSPACE_TABS: WorkspaceTab[] = [
	{
		id: 'editor',
		label: '1. Editor',
		segment: 'editor',
		dotClass: 'bg-tone-editor',
		accentClass: 'border-tone-editor bg-tone-editor-soft text-tone-editor-ink'
	},
	{
		id: 'data',
		label: '2. Data & Mapping',
		segment: 'data',
		dotClass: 'bg-tone-data',
		accentClass: 'border-tone-data bg-tone-data-soft text-tone-data-ink'
	},
	{
		id: 'certificates',
		label: '3. Generate Certificates',
		segment: 'certificates',
		dotClass: 'bg-tone-certs',
		accentClass: 'border-tone-certs bg-tone-certs-soft text-tone-certs-ink'
	},
	{
		id: 'email',
		label: '4. Send Email',
		segment: 'email',
		dotClass: 'bg-tone-email',
		accentClass: 'border-tone-email bg-tone-email-soft text-tone-email-ink'
	},
	{
		id: 'settings',
		label: 'Settings',
		segment: 'settings',
		dotClass: '',
		accentClass: 'border-ink-primary bg-surface-subtle text-ink-primary'
	}
];
