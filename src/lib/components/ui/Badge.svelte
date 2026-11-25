<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'red';
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();

	const toneClasses: Record<NonNullable<Props['tone']>, string> = {
		neutral:
			'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
		indigo:
			'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300',
		emerald:
			'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300',
		amber:
			'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300',
		sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-300',
		red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300'
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {toneClasses[tone]}"
>
	{@render children()}
</span>
