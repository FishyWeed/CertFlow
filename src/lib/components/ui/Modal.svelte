<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		Dialog,
		DialogBackdrop,
		DialogClose,
		DialogContent,
		DialogDescription,
		DialogTitle
	} from '@ui-sdk/svelte/dialog';
	import { X } from '@lucide/svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		/** Defaults to false so active form edits do not close on an accidental outside click. */
		closeOnOutsidePress?: boolean;
		maxWidthClass?: string;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		closeOnOutsidePress = false,
		maxWidthClass = 'max-w-lg',
		children
	}: Props = $props();
</script>

<!-- Use explicit presentation="dialog" so touch devices do not inject sheet transforms that conflict with centring. -->
<Dialog bind:open {closeOnOutsidePress} presentation="dialog">
	<DialogBackdrop class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs" />
	<DialogContent
		class="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90dvh] w-auto {maxWidthClass} -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-default bg-surface-card p-5 shadow-xl outline-none sm:p-6"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<DialogTitle class="text-base font-semibold text-ink-primary sm:text-lg">{title}</DialogTitle>
				{#if description}
					<DialogDescription class="mt-1 text-xs text-ink-secondary sm:text-sm">
						{description}
					</DialogDescription>
				{/if}
			</div>
			<DialogClose
				aria-label="Close dialogue"
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-subtle hover:text-ink-primary"
			>
				<X class="h-5 w-5" />
			</DialogClose>
		</div>

		<div class="mt-4 sm:mt-5">
			{@render children()}
		</div>
	</DialogContent>
</Dialog>
