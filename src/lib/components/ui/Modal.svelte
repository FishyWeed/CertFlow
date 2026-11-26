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
		icon?: Snippet;
		children: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		description,
		closeOnOutsidePress = false,
		maxWidthClass = 'max-w-lg',
		icon,
		children
	}: Props = $props();
</script>

<!-- Use explicit presentation="dialog" so touch devices do not inject sheet transforms that conflict with centring. -->
<Dialog bind:open {closeOnOutsidePress} presentation="dialog">
	<DialogBackdrop
		class="cf-backdrop-in fixed inset-0 z-50 bg-black/52 backdrop-blur-[5px] dark:bg-black/76"
	/>
	<DialogContent
		class="cf-modal-in fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90dvh] w-auto {maxWidthClass} -translate-y-1/2 overflow-y-auto rounded-[20px] border border-border-default bg-surface-elevated p-5 shadow-lg outline-none sm:p-6"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				{#if icon}
					<div
						class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border-default bg-surface-subtle text-accent-vivid shadow-xs"
					>
						{@render icon()}
					</div>
				{/if}
				<DialogTitle class="font-display text-base font-semibold tracking-tight text-ink-primary sm:text-lg">
					{title}
				</DialogTitle>
				{#if description}
					<DialogDescription class="mt-1 text-xs text-ink-secondary sm:text-sm">
						{description}
					</DialogDescription>
				{/if}
			</div>
			<DialogClose
				aria-label="Close dialogue"
				class="cf-pressable flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
			>
				<X class="h-[18px] w-[18px]" />
			</DialogClose>
		</div>

		<div class="mt-5">
			{@render children()}
		</div>
	</DialogContent>
</Dialog>
