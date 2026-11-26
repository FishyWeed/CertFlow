<script lang="ts">
	interface Props {
		id?: string;
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		pixelsPerStep?: number;
		onScrubStart?: () => void;
		onValueChange: (value: number, meta: { scrubbing: boolean }) => void;
	}

	let {
		id,
		label,
		value,
		min,
		max,
		step = 1,
		pixelsPerStep,
		onScrubStart,
		onValueChange
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let isScrubbing = $state(false);

	const effectivePxPerStep = $derived(pixelsPerStep ?? (step >= 1 ? 2 : 6));
	const decimals = $derived.by(() => {
		const parts = String(step).split('.');
		return parts[1]?.length ?? 0;
	});

	function clampAndRound(raw: number): number {
		let next = Number.isFinite(raw) ? raw : value;
		if (min !== undefined) next = Math.max(min, next);
		if (max !== undefined) next = Math.min(max, next);
		const factor = 10 ** decimals;
		return Math.round(next * factor) / factor;
	}

	function beginScrub(event: PointerEvent, immediate: boolean) {
		if (event.button !== 0) return;

		// Allow normal text selection if the user already focused the input to type.
		if (!immediate && document.activeElement === inputEl) return;

		if (immediate) {
			event.preventDefault();
		}

		const startX = event.clientX;
		const startValue = value;
		let active = immediate;
		let historyStarted = false;

		const activateScrub = () => {
			if (!historyStarted) {
				historyStarted = true;
				onScrubStart?.();
			}
			isScrubbing = true;
			inputEl?.blur();
			document.body.style.cursor = 'ew-resize';
			document.body.style.userSelect = 'none';
		};

		if (immediate) {
			activateScrub();
		}

		const onMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - startX;
			if (!active) {
				if (Math.abs(dx) < 4) return;
				active = true;
				activateScrub();
			}

			const multiplier = moveEvent.shiftKey ? 10 : 1;
			const stepsDelta = Math.trunc(dx / effectivePxPerStep);
			const nextVal = clampAndRound(startValue + stepsDelta * step * multiplier);
			if (nextVal !== value) {
				onValueChange(nextVal, { scrubbing: true });
			}
		};

		const onEnd = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onEnd);
			window.removeEventListener('pointercancel', onEnd);
			if (isScrubbing) {
				isScrubbing = false;
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			}
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onEnd);
		window.addEventListener('pointercancel', onEnd);
	}

	function handleCommitInput(event: Event) {
		const raw = Number((event.currentTarget as HTMLInputElement).value);
		const next = clampAndRound(raw);
		onValueChange(next, { scrubbing: false });
	}
</script>

<div class="min-w-0">
	<label
		for={id}
		title="Hold and drag left or right to adjust (Shift for 10x)"
		onpointerdown={(e) => beginScrub(e, true)}
		class="group inline-flex cursor-ew-resize items-center gap-1 text-xs font-medium text-ink-secondary select-none transition-colors hover:text-accent-ink"
	>
		<span>{label}</span>
		<span
			aria-hidden="true"
			class="text-[10px] tracking-tighter transition-opacity {isScrubbing
				? 'text-accent-vivid opacity-100'
				: 'opacity-40 group-hover:opacity-90'}"
		>
			‹›
		</span>
	</label>
	<input
		bind:this={inputEl}
		{id}
		type="number"
		{min}
		{max}
		{step}
		{value}
		onpointerdown={(e) => beginScrub(e, false)}
		onchange={handleCommitInput}
		title="Click to type, or hold and drag left or right to adjust"
		class="mt-1 block h-[30px] w-full rounded-md border px-2.5 font-mono text-xs text-ink-primary tabular-nums outline-none transition {isScrubbing
			? 'cf-scrub-active cursor-ew-resize'
			: 'border-border-strong bg-surface-card hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed'}"
	/>
</div>
