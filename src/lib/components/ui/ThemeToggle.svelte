<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { theme } from '#lib/stores/theme.svelte.ts';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<button
	type="button"
	onclick={() => theme.toggle()}
	aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={theme.isDark}
	class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-card text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary {className}"
>
	{#if theme.isDark}
		<Sun class="h-4 w-4 text-amber-400" />
	{:else}
		<Moon class="h-4 w-4" />
	{/if}
</button>
