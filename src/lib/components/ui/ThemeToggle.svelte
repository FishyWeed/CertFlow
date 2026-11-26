<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { theme } from '#lib/stores/theme.svelte.ts';

	interface Props {
		floating?: boolean;
		class?: string;
	}

	let { floating = false, class: className = '' }: Props = $props();
</script>

<button
	type="button"
	onclick={() => theme.toggle()}
	aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={theme.isDark}
	class="cf-pressable inline-flex shrink-0 cursor-pointer items-center justify-center border text-ink-secondary transition hover:text-ink-primary {floating
		? 'h-11 w-11 rounded-full border-border-strong bg-surface-elevated/92 shadow-md backdrop-blur-md hover:border-ink-muted/70 hover:bg-surface-card'
		: 'h-9 w-9 rounded-lg border-border-default bg-surface-card shadow-xs hover:bg-surface-subtle'} {className}"
>
	{#key theme.isDark}
		<span class="cf-theme-morph inline-flex items-center justify-center">
			{#if theme.isDark}
				<Sun class="{floating ? 'h-4.5 w-4.5' : 'h-4 w-4'} text-[#F5B942]" />
			{:else}
				<Moon class={floating ? 'h-4.5 w-4.5' : 'h-4 w-4'} />
			{/if}
		</span>
	{/key}
</button>
