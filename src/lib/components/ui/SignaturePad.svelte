<script lang="ts">
	import { Check, Eraser } from '@lucide/svelte';
	import ScrubNumberInput from './ScrubNumberInput.svelte';

	interface Props {
		saving?: boolean;
		onSaveDrawing: (result: { file: File; width: number; height: number }) => Promise<void> | void;
	}

	let { saving = false, onSaveDrawing }: Props = $props();

	const PAD_W = 560;
	const PAD_H = 200;

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let penColor = $state('#000000');
	let penWidth = $state(4);
	let hasStrokes = $state(false);
	let drawing = false;
	let lastPoint: { x: number; y: number } | null = null;

	function getCanvasPoint(event: PointerEvent): { x: number; y: number } | null {
		if (!canvasEl) return null;
		const rect = canvasEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		return {
			x: ((event.clientX - rect.left) / rect.width) * PAD_W,
			y: ((event.clientY - rect.top) / rect.height) * PAD_H
		};
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0 || !canvasEl) return;
		const pt = getCanvasPoint(event);
		if (!pt) return;
		event.preventDefault();
		canvasEl.setPointerCapture(event.pointerId);

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		drawing = true;
		lastPoint = pt;
		hasStrokes = true;

		ctx.fillStyle = penColor;
		ctx.beginPath();
		ctx.arc(pt.x, pt.y, penWidth / 2, 0, Math.PI * 2);
		ctx.fill();
	}

	function handlePointerMove(event: PointerEvent) {
		if (!drawing || !lastPoint || !canvasEl) return;
		const pt = getCanvasPoint(event);
		if (!pt) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		ctx.strokeStyle = penColor;
		ctx.lineWidth = penWidth;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(lastPoint.x, lastPoint.y);
		ctx.lineTo(pt.x, pt.y);
		ctx.stroke();

		lastPoint = pt;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!drawing) return;
		drawing = false;
		lastPoint = null;
		if (canvasEl?.hasPointerCapture(event.pointerId)) {
			canvasEl.releasePointerCapture(event.pointerId);
		}
	}

	export function clearPad() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		ctx?.clearRect(0, 0, PAD_W, PAD_H);
		hasStrokes = false;
	}

	async function handleApplyDrawing() {
		if (!canvasEl || !hasStrokes) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		// Auto-trim transparent margins so the drawn signature fits cleanly inside the certificate box.
		const imgData = ctx.getImageData(0, 0, PAD_W, PAD_H).data;
		let minX = PAD_W;
		let minY = PAD_H;
		let maxX = 0;
		let maxY = 0;

		for (let y = 0; y < PAD_H; y++) {
			for (let x = 0; x < PAD_W; x++) {
				if (imgData[(y * PAD_W + x) * 4 + 3] > 0) {
					if (x < minX) minX = x;
					if (y < minY) minY = y;
					if (x > maxX) maxX = x;
					if (y > maxY) maxY = y;
				}
			}
		}

		if (maxX < minX || maxY < minY) return;

		const pad = 12;
		const sx = Math.max(0, minX - pad);
		const sy = Math.max(0, minY - pad);
		const sw = Math.min(PAD_W - sx, maxX - minX + 1 + pad * 2);
		const sh = Math.min(PAD_H - sy, maxY - minY + 1 + pad * 2);

		const out = document.createElement('canvas');
		out.width = sw;
		out.height = sh;
		const outCtx = out.getContext('2d');
		if (!outCtx) return;
		outCtx.drawImage(canvasEl, sx, sy, sw, sh, 0, 0, sw, sh);

		const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
		if (!blob) return;

		const file = new File([blob], 'signature.png', { type: 'image/png' });
		await onSaveDrawing({ file, width: sw, height: sh });
	}
</script>

<div class="space-y-2.5">
	<div class="grid grid-cols-2 gap-2">
		<div>
			<label for="sig-ink-color" class="block text-xs font-medium text-ink-secondary">
				Ink Colour
			</label>
			<input
				id="sig-ink-color"
				type="color"
				bind:value={penColor}
				class="mt-1 h-8 w-full cursor-pointer rounded border border-border-strong"
			/>
		</div>
		<ScrubNumberInput
			id="sig-pen-size"
			label="Pen Size"
			min={1}
			max={14}
			step={1}
			pixelsPerStep={4}
			value={penWidth}
			onValueChange={(next) => (penWidth = next)}
		/>
	</div>

	<!-- Rectangular drawing pad with visual baseline guide (not exported into PNG) -->
	<div class="relative overflow-hidden rounded-lg border border-border-strong bg-white">
		<div
			class="pointer-events-none absolute inset-x-4 bottom-5 border-b border-dashed border-slate-200"
		></div>
		{#if !hasStrokes}
			<span
				class="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 select-none"
			>
				Draw signature here
			</span>
		{/if}
		<canvas
			bind:this={canvasEl}
			width={PAD_W}
			height={PAD_H}
			aria-label="Signature drawing box"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			style="touch-action: none;"
			class="block h-28 w-full cursor-crosshair"
		></canvas>
	</div>

	<div class="flex items-center gap-1.5">
		<button
			type="button"
			disabled={!hasStrokes || saving}
			onclick={clearPad}
			class="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle disabled:opacity-50"
		>
			<Eraser class="h-3.5 w-3.5" />
			Clear
		</button>
		<button
			type="button"
			disabled={!hasStrokes || saving}
			onclick={handleApplyDrawing}
			class="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
		>
			<Check class="h-3.5 w-3.5" />
			{saving ? 'Saving...' : 'Use Drawing'}
		</button>
	</div>
</div>
