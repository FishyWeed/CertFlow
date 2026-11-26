<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'danger' | 'red';
		dot?: boolean;
		class?: string;
		children: Snippet;
	}

	let { tone = 'neutral', dot = false, class: className = '', children }: Props = $props();

	const toneClasses: Record<NonNullable<Props['tone']>, string> = {
		neutral: 'border-border-default bg-surface-subtle text-ink-secondary',
		indigo: 'border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink',
		emerald: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink',
		amber: 'border-tone-certs-border bg-tone-certs-soft text-tone-certs-ink',
		sky: 'border-tone-email-border bg-tone-email-soft text-tone-email-ink',
		danger: 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink',
		red: 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs leading-4 font-medium whitespace-nowrap tabular-nums {toneClasses[tone]} {className}"
>
	{#if dot}
		<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
	{/if}
	{@render children()}
</span>
