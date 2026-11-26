<script lang="ts">
	import { Maximize2, RefreshCw, X } from '@lucide/svelte';
	import type { TemplateCanvasState } from '#lib/types/certflow.ts';
	import { renderCertificatePreviewDataUrl } from './renderer.ts';

	interface Props {
		templateName: string;
		width: number;
		height: number;
		canvasState: TemplateCanvasState;
		data: Record<string, string>;
		recipientName: string;
		certCode: string;
	}

	let { templateName, width, height, canvasState, data, recipientName, certCode }: Props = $props();

	let previewDataUrl = $state<string | null>(null);
	let rendering = $state(false);
	let renderError = $state('');
	let expanded = $state(false);
	let requestCounter = 0;

	// Portal the lightbox to document.body so parent `position: sticky` columns never trap its stacking context.
	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	const renderSignature = $derived(
		JSON.stringify({ width, height, templateName, data, canvasState })
	);

	$effect(() => {
		// Track reactive inputs via renderSignature.
		void renderSignature;
		const currentRequest = ++requestCounter;
		const currentWidth = width;
		const currentHeight = height;
		const currentCanvas = canvasState;
		const currentData = { ...data };

		rendering = true;
		renderError = '';

		const timer = setTimeout(async () => {
			try {
				const url = await renderCertificatePreviewDataUrl({
					width: currentWidth,
					height: currentHeight,
					canvasState: currentCanvas,
					data: currentData,
					pixelRatio: 1.5
				});
				if (currentRequest !== requestCounter) return;
				previewDataUrl = url;
			} catch (err) {
				if (currentRequest !== requestCounter) return;
				renderError = err instanceof Error ? err.message : 'Preview failed to render.';
			} finally {
				if (currentRequest === requestCounter) {
					rendering = false;
				}
			}
		}, 90);

		return () => {
			clearTimeout(timer);
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && expanded) expanded = false;
	}}
/>

<div class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-xs">
	<div class="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3">
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-[0.07em] text-tone-editor-ink uppercase">
				Certificate Preview
			</p>
			<p class="truncate text-xs font-medium text-ink-secondary tabular-nums">
				{templateName} · {width}×{height}px
			</p>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if rendering}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-tone-editor-border bg-tone-editor-soft px-2 py-0.5 text-[11px] font-medium text-tone-editor-ink"
				>
					<RefreshCw class="h-3 w-3 animate-spin" />
					Updating
				</span>
			{/if}
			<button
				type="button"
				disabled={!previewDataUrl}
				onclick={() => (expanded = true)}
				title="Expand preview"
				aria-label="Expand preview"
				class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-strong bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary disabled:opacity-40"
			>
				<Maximize2 class="h-3.5 w-3.5" />
				Expand
			</button>
		</div>
	</div>

	<div class="editor-sandbox-grid flex items-center justify-center p-4 sm:p-6">
		{#if renderError}
			<div class="rounded-lg border border-tone-danger-border bg-tone-danger-soft px-3 py-2 text-xs text-tone-danger-ink">
				{renderError}
			</div>
		{:else if previewDataUrl}
			<img
				src={previewDataUrl}
				alt="Certificate preview for {recipientName}"
				style="aspect-ratio: {width} / {height};"
				class="preserve-light max-h-[520px] w-full rounded-[3px] bg-white object-contain"
			/>
		{:else}
			<div
				style="aspect-ratio: {width} / {height};"
				class="preserve-light flex w-full items-center justify-center rounded-[3px] border border-dashed border-border-strong bg-white/90 text-xs text-ink-muted"
			>
				Rendering preview...
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between border-t border-border-default bg-surface-page px-4 py-2 text-[11px] text-ink-muted">
		<span class="truncate font-medium text-ink-secondary">{recipientName}</span>
		<span class="shrink-0 font-mono tabular-nums">{certCode}</span>
	</div>
</div>

{#if expanded && previewDataUrl}
	<div
		use:portalToBody
		role="dialog"
		aria-modal="true"
		aria-label="Expanded certificate preview for {recipientName}"
		class="cf-backdrop-in fixed inset-0 z-[100] flex items-center justify-center bg-black/72 p-4 backdrop-blur-[5px] sm:p-8"
	>
		<div
			role="presentation"
			onclick={() => (expanded = false)}
			class="fixed inset-0"
		></div>
		<div
			class="cf-modal-in relative z-10 flex max-h-full max-w-6xl flex-col overflow-hidden rounded-[20px] border border-border-default bg-surface-elevated shadow-lg"
		>
			<div class="flex items-center justify-between gap-4 border-b border-border-default px-5 py-3.5">
				<div class="min-w-0">
					<p class="font-display truncate text-sm font-semibold text-ink-primary">{recipientName}</p>
					<p class="truncate font-mono text-xs text-ink-muted">
						{templateName} · {certCode}
					</p>
				</div>
				<button
					type="button"
					aria-label="Close expanded preview"
					onclick={() => (expanded = false)}
					class="cf-pressable cursor-pointer rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
				>
					<X class="h-[18px] w-[18px]" />
				</button>
			</div>
			<div class="editor-sandbox-grid flex items-center justify-center overflow-auto p-5 sm:p-8">
				<img
					src={previewDataUrl}
					alt="Expanded certificate preview for {recipientName}"
					class="preserve-light max-h-[80vh] max-w-full rounded-[3px] bg-white"
				/>
			</div>
		</div>
	</div>
{/if}
