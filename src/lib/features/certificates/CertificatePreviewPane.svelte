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

<div class="flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card">
	<div class="flex items-center justify-between gap-2 border-b border-border-default px-4 py-3">
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
				Certificate Preview
			</p>
			<p class="truncate text-xs font-medium text-ink-secondary">
				{templateName} · {width}×{height}px
			</p>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if rendering}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
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
				class="inline-flex items-center gap-1 rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary disabled:opacity-40"
			>
				<Maximize2 class="h-3.5 w-3.5" />
				Expand
			</button>
		</div>
	</div>

	<div class="flex items-center justify-center bg-slate-100/90 p-4 sm:p-5">
		{#if renderError}
			<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
				{renderError}
			</div>
		{:else if previewDataUrl}
			<img
				src={previewDataUrl}
				alt="Certificate preview for {recipientName}"
				style="aspect-ratio: {width} / {height};"
				class="max-h-[520px] w-full rounded border border-slate-200 bg-white object-contain shadow-md"
			/>
		{:else}
			<div
				style="aspect-ratio: {width} / {height};"
				class="flex w-full items-center justify-center rounded border border-dashed border-border-strong bg-white/80 text-xs text-ink-muted"
			>
				Rendering preview...
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between border-t border-border-default bg-surface-page px-4 py-2 text-[11px] text-ink-muted">
		<span class="truncate font-medium text-ink-secondary">{recipientName}</span>
		<span class="shrink-0 font-mono">{certCode}</span>
	</div>
</div>

{#if expanded && previewDataUrl}
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Expanded certificate preview for {recipientName}"
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-xs sm:p-8"
	>
		<div
			role="presentation"
			onclick={() => (expanded = false)}
			class="fixed inset-0"
		></div>
		<div class="relative z-10 flex max-h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-card shadow-2xl">
			<div class="flex items-center justify-between gap-4 border-b border-border-default px-4 py-3">
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-ink-primary">{recipientName}</p>
					<p class="truncate text-xs text-ink-muted">
						{templateName} · {certCode}
					</p>
				</div>
				<button
					type="button"
					aria-label="Close expanded preview"
					onclick={() => (expanded = false)}
					class="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
			<div class="flex items-center justify-center overflow-auto bg-slate-100 p-4 sm:p-6">
				<img
					src={previewDataUrl}
					alt="Expanded certificate preview for {recipientName}"
					class="max-h-[80vh] max-w-full rounded border border-slate-200 bg-white shadow-lg"
				/>
			</div>
		</div>
	</div>
{/if}
