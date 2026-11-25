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
		accentClass:
			'border-indigo-600 text-indigo-700 bg-indigo-50/70 dark:border-indigo-400 dark:text-indigo-300 dark:bg-indigo-500/15'
	},
	{
		id: 'data',
		label: '2. Data & Mapping',
		segment: 'data',
		accentClass:
			'border-emerald-600 text-emerald-700 bg-emerald-50/70 dark:border-emerald-400 dark:text-emerald-300 dark:bg-emerald-500/15'
	},
	{
		id: 'certificates',
		label: '3. Generate Certificates',
		segment: 'certificates',
		accentClass:
			'border-amber-600 text-amber-700 bg-amber-50/70 dark:border-amber-400 dark:text-amber-300 dark:bg-amber-500/15'
	},
	{
		id: 'email',
		label: '4. Send Email',
		segment: 'email',
		accentClass:
			'border-sky-600 text-sky-700 bg-sky-50/70 dark:border-sky-400 dark:text-sky-300 dark:bg-sky-500/15'
	},
	{
		id: 'settings',
		label: 'Settings',
		segment: 'settings',
		accentClass:
			'border-slate-700 text-slate-900 bg-slate-100 dark:border-slate-400 dark:text-slate-100 dark:bg-slate-800'
	}
];
