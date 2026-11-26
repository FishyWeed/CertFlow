<script lang="ts">
	import type { Snippet } from 'svelte';
	import CertFlowLogo from '#lib/components/ui/CertFlowLogo.svelte';

	interface Props {
		brandHref?: string;
		brandName?: string;
		sticky?: boolean;
		maxWidthClass?: string;
		center?: Snippet;
		actions?: Snippet;
	}

	let {
		brandHref = '/',
		brandName = 'CertFlow',
		sticky = true,
		maxWidthClass = 'max-w-[1600px]',
		center,
		actions
	}: Props = $props();
</script>

<header
	class="h-14 w-full border-b border-border-default bg-surface-card/88 backdrop-blur-md {sticky
		? 'sticky top-0 z-40'
		: ''}"
>
	<div
		class="mx-auto flex h-full {maxWidthClass} items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 {center
			? 'md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
			: ''}"
	>
		<a
			href={brandHref}
			class="flex min-w-0 shrink-0 items-center gap-2.5 justify-self-start text-ink-primary transition-opacity hover:opacity-90"
		>
			<CertFlowLogo variant="studio" size={28} decorative />
			<span class="font-display truncate text-[17px] font-semibold tracking-[-0.03em] text-ink-primary">
				{brandName}
			</span>
		</a>

		{#if center}
			<div class="hidden min-w-0 items-center justify-center justify-self-center md:flex">
				{@render center()}
			</div>
		{/if}

		<div class="flex shrink-0 items-center gap-1.5 justify-self-end sm:gap-2.5">
			{#if actions}
				{@render actions()}
			{/if}
		</div>
	</div>
</header>
