<script lang="ts">
	import { Lock, RotateCcw, RotateCw, Unlock } from '@lucide/svelte';
	import type { ImageEditState } from '#lib/types/certflow.ts';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';
	import ScrubNumberInput from './ScrubNumberInput.svelte';
	import {
		applyCropDrag,
		clampCropRect,
		computeInitialCrop,
		computeResizedDimensions,
		drawRotatedImageToCanvas,
		normaliseRotation,
		renderCroppedImageBlob,
		type CropHandle,
		type CropRect
	} from './image-crop.ts';

	interface Props {
		open: boolean;
		sourceUrl: string | null;
		fileName: string;
		mimeType?: string;
		mode: 'image' | 'background';
		canvasWidth?: number;
		canvasHeight?: number;
		initialEditState?: ImageEditState;
		onApply: (result: {
			file: File;
			width: number;
			height: number;
			editState: ImageEditState;
			isUnchangedFullFrame?: boolean;
		}) => Promise<void> | void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		sourceUrl,
		fileName,
		mimeType = 'image/png',
		mode,
		canvasWidth = 1123,
		canvasHeight = 794,
		initialEditState,
		onApply,
		onCancel
	}: Props = $props();

	let imgEl = $state<HTMLImageElement | null>(null);
	let previewCanvasEl = $state<HTMLCanvasElement | null>(null);
	let imageLoaded = $state(false);
	let naturalW = $state(0);
	let naturalH = $state(0);
	let displayW = $state(0);
	let displayH = $state(0);

	let rotation = $state(0);
	let crop = $state<CropRect>({ x: 0, y: 0, width: 100, height: 100 });
	let aspectPreset = $state<'free' | 'certificate' | '1:1' | '4:3' | '16:9'>('free');
	let outputWidth = $state(400);
	let outputHeight = $state(300);
	let lockOutputAspect = $state(true);
	let processing = $state(false);
	let errorMessage = $state('');

	const certRatio = $derived(canvasWidth > 0 && canvasHeight > 0 ? canvasWidth / canvasHeight : 1.414);

	const lockedCropRatio = $derived.by<number | undefined>(() => {
		if (aspectPreset === 'certificate') return certRatio;
		if (aspectPreset === '1:1') return 1;
		if (aspectPreset === '4:3') return 4 / 3;
		if (aspectPreset === '16:9') return 16 / 9;
		return undefined;
	});

	const scaleX = $derived(naturalW > 0 && displayW > 0 ? displayW / naturalW : 1);
	const scaleY = $derived(naturalH > 0 && displayH > 0 ? displayH / naturalH : 1);

	function syncDisplaySize() {
		if (!previewCanvasEl) return;
		const rect = previewCanvasEl.getBoundingClientRect();
		displayW = rect.width;
		displayH = rect.height;
	}

	function redrawRotatedPreview(resetOutputDims: boolean) {
		if (!imgEl || !previewCanvasEl || !imageLoaded) return;
		const bounds = drawRotatedImageToCanvas(previewCanvasEl, imgEl, rotation);
		naturalW = bounds.width;
		naturalH = bounds.height;

		const ratio = lockedCropRatio;
		crop = computeInitialCrop(naturalW, naturalH, ratio);

		if (resetOutputDims) {
			if (mode === 'background') {
				const idealW = Math.min(crop.width, Math.max(canvasWidth, Math.min(2246, canvasWidth * 2)));
				const dims = computeResizedDimensions(crop.width, crop.height, idealW, 'width', true, crop.height);
				outputWidth = dims.width;
				outputHeight = dims.height;
			} else {
				outputWidth = crop.width;
				outputHeight = crop.height;
			}
		} else if (lockOutputAspect) {
			const dims = computeResizedDimensions(crop.width, crop.height, outputWidth, 'width', true, outputHeight);
			outputWidth = dims.width;
			outputHeight = dims.height;
		}

		syncDisplaySize();
		requestAnimationFrame(() => syncDisplaySize());
	}

	function applyInitialState(useSavedState = false) {
		if (useSavedState && initialEditState && imgEl && previewCanvasEl && imageLoaded) {
			rotation = normaliseRotation(initialEditState.rotation);
			aspectPreset = initialEditState.aspectPreset ?? (mode === 'background' ? 'certificate' : 'free');
			lockOutputAspect = true;
			const bounds = drawRotatedImageToCanvas(previewCanvasEl, imgEl, rotation);
			naturalW = bounds.width;
			naturalH = bounds.height;
			crop = clampCropRect(initialEditState.crop, naturalW, naturalH, 16);
			outputWidth = Math.max(16, Math.min(4096, Math.round(initialEditState.outputWidth)));
			outputHeight = Math.max(16, Math.min(4096, Math.round(initialEditState.outputHeight)));
			syncDisplaySize();
			requestAnimationFrame(() => syncDisplaySize());
			return;
		}

		rotation = 0;
		aspectPreset = mode === 'background' ? 'certificate' : 'free';
		lockOutputAspect = true;
		redrawRotatedPreview(true);
	}

	function handleImageLoad() {
		if (!imgEl) return;
		imageLoaded = true;
		errorMessage = '';
		applyInitialState(true);
	}

	function setRotation(nextDegrees: number) {
		rotation = normaliseRotation(nextDegrees);
		redrawRotatedPreview(false);
	}

	function selectAspectPreset(preset: typeof aspectPreset) {
		aspectPreset = preset;
		if (!naturalW || !naturalH) return;
		const ratio =
			preset === 'certificate'
				? certRatio
				: preset === '1:1'
					? 1
					: preset === '4:3'
						? 4 / 3
						: preset === '16:9'
							? 16 / 9
							: undefined;
		crop = computeInitialCrop(naturalW, naturalH, ratio);
		if (lockOutputAspect) {
			const dims = computeResizedDimensions(crop.width, crop.height, outputWidth, 'width', true, outputHeight);
			outputWidth = dims.width;
			outputHeight = dims.height;
		}
	}

	function handleReset() {
		applyInitialState();
	}

	function handleFitToCertificate() {
		aspectPreset = 'certificate';
		if (naturalW && naturalH) {
			crop = computeInitialCrop(naturalW, naturalH, certRatio);
		}
		lockOutputAspect = true;
		outputWidth = canvasWidth;
		outputHeight = canvasHeight;
	}

	function startCropDrag(handle: CropHandle, event: PointerEvent) {
		if (event.button !== 0 || !naturalW || !naturalH || !displayW || !displayH) return;
		event.preventDefault();
		event.stopPropagation();

		const startX = event.clientX;
		const startY = event.clientY;
		const startCrop = { ...crop };
		const invX = naturalW / displayW;
		const invY = naturalH / displayH;

		const onMove = (moveEvent: PointerEvent) => {
			const dx = (moveEvent.clientX - startX) * invX;
			const dy = (moveEvent.clientY - startY) * invY;
			const next = applyCropDrag(
				startCrop,
				handle,
				dx,
				dy,
				naturalW,
				naturalH,
				lockedCropRatio
			);
			crop = next;
			if (lockOutputAspect && handle !== 'move') {
				const dims = computeResizedDimensions(
					next.width,
					next.height,
					outputWidth,
					'width',
					true,
					outputHeight
				);
				outputWidth = dims.width;
				outputHeight = dims.height;
			}
		};

		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	async function handleApply() {
		if (!previewCanvasEl || !naturalW || !naturalH) return;
		processing = true;
		errorMessage = '';
		try {
			const { blob, mimeType: outMime, ext } = await renderCroppedImageBlob(
				previewCanvasEl,
				crop,
				outputWidth,
				outputHeight,
				mimeType
			);
			const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
			const croppedFile = new File([blob], `${baseName}.${ext}`, { type: outMime });
			const editState: ImageEditState = {
				rotation,
				crop: { ...crop },
				outputWidth,
				outputHeight,
				aspectPreset
			};
			const isUnchangedFullFrame =
				rotation === 0 &&
				crop.x === 0 &&
				crop.y === 0 &&
				crop.width === naturalW &&
				crop.height === naturalH &&
				outputWidth >= naturalW &&
				outputHeight >= naturalH;
			await onApply({
				file: croppedFile,
				width: outputWidth,
				height: outputHeight,
				editState,
				isUnchangedFullFrame
			});
			open = false;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not apply crop and resize.';
		} finally {
			processing = false;
		}
	}

	function handleCancel() {
		open = false;
		onCancel?.();
	}

	$effect(() => {
		if (!open) {
			imageLoaded = false;
			rotation = 0;
			naturalW = 0;
			naturalH = 0;
			displayW = 0;
			displayH = 0;
			errorMessage = '';
		}
	});

	const presetButtons: Array<{ id: typeof aspectPreset; label: string }> = [
		{ id: 'free', label: 'Free' },
		{ id: 'certificate', label: 'Certificate' },
		{ id: '1:1', label: '1:1' },
		{ id: '4:3', label: '4:3' },
		{ id: '16:9', label: '16:9' }
	];

	const handles: Array<{ id: Exclude<CropHandle, 'move'>; className: string }> = [
		{ id: 'nw', className: '-top-1.5 -left-1.5 cursor-nwse-resize' },
		{ id: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
		{ id: 'ne', className: '-top-1.5 -right-1.5 cursor-nesw-resize' },
		{ id: 'e', className: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
		{ id: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
		{ id: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
		{ id: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
		{ id: 'w', className: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' }
	];
</script>

<svelte:window onresize={syncDisplaySize} />

<Modal
	bind:open
	title={mode === 'background' ? 'Crop, Rotate & Resize Background' : 'Crop, Rotate & Resize Image'}
	description="Rotate or drag the crop frame, then adjust the output dimensions."
	maxWidthClass="max-w-2xl"
>
	<div class="space-y-4">
		<!-- Aspect Ratio Presets, Rotation & Quick Actions -->
		<div class="flex flex-wrap items-center justify-between gap-2">
			<div class="inline-flex flex-wrap items-center gap-0.5 rounded-[10px] border border-border-default bg-surface-subtle p-[3px] dark:bg-surface-recessed">
				{#each presetButtons as p (p.id)}
					<button
						type="button"
						onclick={() => selectAspectPreset(p.id)}
						class="cf-glide-thumb cursor-pointer rounded-[7px] px-2.5 py-1 text-xs font-medium {aspectPreset === p.id
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent text-ink-secondary hover:text-ink-primary'}"
					>
						{p.label}
					</button>
				{/each}
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					title="Rotate 90° left"
					aria-label="Rotate 90 degrees left"
					onclick={() => setRotation(rotation - 90)}
					class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-strong bg-surface-card px-2 py-1 text-xs font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
				>
					<RotateCcw class="h-3.5 w-3.5" />
					90°
				</button>
				<button
					type="button"
					title="Rotate 90° right"
					aria-label="Rotate 90 degrees right"
					onclick={() => setRotation(rotation + 90)}
					class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-strong bg-surface-card px-2 py-1 text-xs font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
				>
					<RotateCw class="h-3.5 w-3.5" />
					90°
				</button>
				{#if mode === 'background'}
					<button
						type="button"
						onclick={handleFitToCertificate}
						class="cf-pressable cursor-pointer rounded-md border border-border-strong bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
					>
						Fit {canvasWidth}×{canvasHeight}
					</button>
				{/if}
				<button
					type="button"
					onclick={handleReset}
					class="cf-pressable cursor-pointer rounded-md border border-border-strong bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
				>
					Reset
				</button>
			</div>
		</div>

		<!-- Hidden source image loader -->
		{#if sourceUrl}
			<img
				bind:this={imgEl}
				src={sourceUrl}
				alt=""
				onload={handleImageLoad}
				class="hidden"
			/>
		{/if}

		<!-- Interactive Crop Stage -->
		<div
			class="flex max-h-[46vh] min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-[#09090b] p-3 select-none"
		>
			{#if sourceUrl}
				<div class="relative inline-block leading-none" style="touch-action: none;">
					<canvas
						bind:this={previewCanvasEl}
						aria-label="Rotated image preview"
						style="max-height: 40vh; max-width: 100%; width: auto; height: auto;"
						class="block"
					></canvas>

					{#if naturalW > 0 && displayW > 0}
						{@const boxL = crop.x * scaleX}
						{@const boxT = crop.y * scaleY}
						{@const boxW = crop.width * scaleX}
						{@const boxH = crop.height * scaleY}

						<!-- Dimmed masks around active crop region -->
						<div
							class="pointer-events-none absolute inset-x-0 top-0 bg-black/60"
							style="height: {boxT}px;"
						></div>
						<div
							class="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60"
							style="top: {boxT + boxH}px;"
						></div>
						<div
							class="pointer-events-none absolute left-0 bg-black/60"
							style="top: {boxT}px; height: {boxH}px; width: {boxL}px;"
						></div>
						<div
							class="pointer-events-none absolute right-0 bg-black/60"
							style="top: {boxT}px; height: {boxH}px; left: {boxL + boxW}px;"
						></div>

						<!-- Interactive Crop Box + Rule of Thirds + 8 Blueprint Cobalt Resize Handles -->
						<div
							role="presentation"
							aria-label="Crop selection area"
							onpointerdown={(e) => startCropDrag('move', e)}
							style="left: {boxL}px; top: {boxT}px; width: {boxW}px; height: {boxH}px;"
							class="absolute cursor-move border-[1.5px] border-white shadow-[0_0_0_1px_#3B5BDB]"
						>
							<!-- Subtle rule-of-thirds gridlines -->
							<div class="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/35"></div>
							<div class="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/35"></div>
							<div class="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/35"></div>
							<div class="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/35"></div>

							{#each handles as h (h.id)}
								<div
									role="presentation"
									onpointerdown={(e) => startCropDrag(h.id, e)}
									class="cf-handle-settle absolute h-2.5 w-2.5 rounded-[2px] border border-[#3B5BDB] bg-white shadow-xs {h.className}"
								></div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Rotation Angle & Output Resize Controls -->
		<div class="rounded-xl border border-border-default bg-surface-page p-3">
			<div class="flex flex-wrap items-center justify-between gap-2 pb-2">
				<span class="text-xs font-semibold text-ink-primary">Rotate & Output Resize</span>
				{#if naturalW > 0}
					<span class="font-mono text-[11px] text-ink-muted tabular-nums">
						Source {naturalW}×{naturalH} · Crop {crop.width}×{crop.height} · {rotation}°
					</span>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr_auto_1fr] sm:items-end">
				<ScrubNumberInput
					id="crop-rotate-deg"
					label="Angle (°)"
					min={-180}
					max={180}
					step={1}
					pixelsPerStep={2}
					value={rotation}
					onValueChange={(next) => setRotation(next)}
				/>

				<ScrubNumberInput
					id="crop-out-w"
					label="Width (px)"
					min={16}
					max={4096}
					step={1}
					pixelsPerStep={1}
					value={outputWidth}
					onValueChange={(next) => {
						const dims = computeResizedDimensions(
							crop.width,
							crop.height,
							next,
							'width',
							lockOutputAspect,
							outputHeight
						);
						outputWidth = dims.width;
						outputHeight = dims.height;
					}}
				/>

				<button
					type="button"
					title={lockOutputAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
					aria-label={lockOutputAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
					onclick={() => (lockOutputAspect = !lockOutputAspect)}
					class="cf-pressable inline-flex h-[30px] cursor-pointer items-center justify-center gap-1 rounded-md border px-2.5 text-xs font-medium {lockOutputAspect
						? 'border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink'
						: 'border-border-strong bg-surface-card text-ink-secondary hover:bg-surface-subtle'}"
				>
					{#if lockOutputAspect}
						<Lock class="h-3.5 w-3.5" />
					{:else}
						<Unlock class="h-3.5 w-3.5" />
					{/if}
					<span class="sm:hidden">{lockOutputAspect ? 'Ratio locked' : 'Free ratio'}</span>
				</button>

				<ScrubNumberInput
					id="crop-out-h"
					label="Height (px)"
					min={16}
					max={4096}
					step={1}
					pixelsPerStep={1}
					value={outputHeight}
					onValueChange={(next) => {
						const dims = computeResizedDimensions(
							crop.width,
							crop.height,
							next,
							'height',
							lockOutputAspect,
							outputWidth
						);
						outputWidth = dims.width;
						outputHeight = dims.height;
					}}
				/>
			</div>
		</div>

		{#if errorMessage}
			<p class="text-xs text-tone-danger-ink">{errorMessage}</p>
		{/if}

		<div class="flex justify-end gap-2.5 border-t border-border-subtle pt-4">
			<Button onclick={handleCancel} disabled={processing}>Cancel</Button>
			<Button variant="contrast" onclick={handleApply} disabled={processing || naturalW === 0}>
				{processing ? 'Processing...' : 'Apply & Upload'}
			</Button>
		</div>
	</div>
</Modal>
