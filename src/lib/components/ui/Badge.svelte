<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'red';
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();

	const toneClasses: Record<NonNullable<Props['tone']>, string> = {
		neutral: 'border-slate-200 bg-slate-100 text-slate-700',
		indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
		emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
		amber: 'border-amber-200 bg-amber-50 text-amber-800',
		sky: 'border-sky-200 bg-sky-50 text-sky-700',
		red: 'border-red-200 bg-red-50 text-red-700'
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {toneClasses[tone]}"
>
	{@render children()}
</span>
