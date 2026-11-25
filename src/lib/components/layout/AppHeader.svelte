<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Award } from '@lucide/svelte';
	import ThemeToggle from '#lib/components/ui/ThemeToggle.svelte';

	interface Props {
		brandHref?: string;
		brandName?: string;
		sticky?: boolean;
		actions?: Snippet;
	}

	let { brandHref = '/', brandName = 'CertFlow', sticky = true, actions }: Props = $props();
</script>

<header
	class="w-full border-b border-border-default bg-surface-card {sticky ? 'sticky top-0 z-40' : ''}"
>
	<div class="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6">
		<a
			href={brandHref}
			class="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-ink-primary"
		>
			<span
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-xs sm:h-9 sm:w-9"
			>
				<Award class="h-4 w-4 sm:h-5 sm:w-5" />
			</span>
			<span class="truncate text-base sm:text-lg">{brandName}</span>
		</a>

		<div class="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
			<ThemeToggle />
			{#if actions}
				{@render actions()}
			{/if}
		</div>
	</div>
</header>
