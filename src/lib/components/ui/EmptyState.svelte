<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description: string;
		action?: Snippet;
	}

	let { title, description, action }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-card px-6 py-12 text-center"
>
	<h2 class="text-base font-semibold text-ink-primary">{title}</h2>
	<p class="mt-1.5 max-w-md text-sm text-ink-muted">{description}</p>
	{#if action}
		<div class="mt-5">
			{@render action()}
		</div>
	{/if}
</div>
