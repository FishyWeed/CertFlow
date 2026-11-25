export interface WorkspaceTab {
	id: 'editor' | 'data' | 'certificates' | 'email' | 'settings';
	label: string;
	segment: string;
	accentClass: string;
}

// Colour-coded tabs so each stage of a project workspace reads clearly at a glance.
export const PROJECT_WORKSPACE_TABS: WorkspaceTab[] = [
	{
		id: 'editor',
		label: '1. Editor',
		segment: 'editor',
		accentClass: 'border-indigo-600 text-indigo-700 bg-indigo-50/70'
	},
	{
		id: 'data',
		label: '2. Data & Mapping',
		segment: 'data',
		accentClass: 'border-emerald-600 text-emerald-700 bg-emerald-50/70'
	},
	{
		id: 'certificates',
		label: '3. Generate Certificates',
		segment: 'certificates',
		accentClass: 'border-amber-600 text-amber-700 bg-amber-50/70'
	},
	{
		id: 'email',
		label: '4. Send Email',
		segment: 'email',
		accentClass: 'border-sky-600 text-sky-700 bg-sky-50/70'
	},
	{
		id: 'settings',
		label: 'Settings',
		segment: 'settings',
		accentClass: 'border-slate-700 text-slate-900 bg-slate-100'
	}
];
