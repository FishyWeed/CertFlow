<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description: string;
		icon?: Snippet;
		action?: Snippet;
	}

	let { title, description, icon, action }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-card/75 px-6 py-12 text-center"
>
	{#if icon}
		<div
			class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border-default bg-surface-subtle text-ink-primary shadow-xs"
		>
			{@render icon()}
		</div>
	{/if}
	<h2 class="font-display text-[15px] font-semibold tracking-tight text-ink-primary">{title}</h2>
	<p class="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">{description}</p>
	{#if action}
		<div class="mt-5">
			{@render action()}
		</div>
	{/if}
</div>
