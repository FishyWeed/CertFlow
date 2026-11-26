<script lang="ts">
	import {
		AlignCenter,
		AlignJustify,
		AlignLeft,
		AlignRight,
		ArrowDownToLine,
		ArrowUpToLine,
		Bold,
		ChevronDown,
		Copy,
		FoldVertical,
		Group,
		Italic,
		Minus,
		Plus,
		RemoveFormatting,
		SlidersHorizontal,
		Trash2,
		Underline,
		Ungroup,
		X
	} from '@lucide/svelte';
	import ScrubNumberInput from '#lib/components/ui/ScrubNumberInput.svelte';
	import type {
		TextAlign,
		TextTransformMode,
		TextWrapMode,
		VerticalAlign
	} from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import FontPicker from './FontPicker.svelte';
	import { ensureFontLoaded } from './fonts.ts';
	import {
		hasElementRichText,
		inspectSelectionStyle,
		parseRichTextRuns,
		stripRichTextMarkup,
		type RichTextStyle
	} from './rich-text.ts';
	import {
		resolveElementText,
		scaleBoxForFontFamilyChange,
		scaleBoxForFontSizeChange,
		type TextualCanvasElement
	} from './text-utils.ts';

	interface Props {
		editor: EditorState;
		sampleData?: Record<string, string>;
	}

	let { editor, sampleData = {} }: Props = $props();

	const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 96];

	const alignOptions: Array<{ value: TextAlign; label: string }> = [
		{ value: 'left', label: 'Align left' },
		{ value: 'center', label: 'Align centre' },
		{ value: 'right', label: 'Align right' },
		{ value: 'justify', label: 'Justify' }
	];

	const vAlignOptions: Array<{ value: VerticalAlign; label: string }> = [
		{ value: 'top', label: 'Align top' },
		{ value: 'middle', label: 'Align middle' },
		{ value: 'bottom', label: 'Align bottom' }
	];

	const transformOptions: Array<{ value: TextTransformMode; label: string }> = [
		{ value: 'none', label: 'Normal' },
		{ value: 'uppercase', label: 'UPPERCASE' },
		{ value: 'capitalize', label: 'Title Case' },
		{ value: 'lowercase', label: 'lowercase' }
	];

	const wrapOptions: Array<{ value: TextWrapMode; label: string }> = [
		{ value: 'word', label: 'Word Wrap' },
		{ value: 'char', label: 'Character Wrap' },
		{ value: 'none', label: 'No Wrap (Single Line)' }
	];

	const selected = $derived(editor.selectedElement);
	const isTextSelected = $derived(
		Boolean(
			selected &&
				(selected.type === 'text' || selected.type === 'placeholder' || selected.type === 'title')
		)
	);
	const selectedTextEl = $derived(isTextSelected ? (selected as TextualCanvasElement) : null);

	// Active highlighted text inside Text Content or a Conditional Rule's Show Text textarea.
	const activeSel = $derived(
		selectedTextEl && editor.activeTextSelection?.elementId === selectedTextEl.id
			? editor.activeTextSelection
			: null
	);

	const effectiveStyle = $derived.by<RichTextStyle | null>(() => {
		if (!selectedTextEl) return null;
		const base: RichTextStyle = {
			fontFamily: selectedTextEl.fontFamily,
			fontSize: selectedTextEl.fontSize,
			fontWeight: selectedTextEl.fontWeight,
			fontStyle: selectedTextEl.fontStyle,
			underline: selectedTextEl.textDecoration === 'underline',
			fill: selectedTextEl.fill
		};
		if (!activeSel) return base;
		if (activeSel.effectiveStyle) return activeSel.effectiveStyle;
		return inspectSelectionStyle(activeSel.text, activeSel.start, activeSel.end, base);
	});

	const hasAnyInlineMarkup = $derived(
		Boolean(selectedTextEl && hasElementRichText(selectedTextEl))
	);

	// Floating popovers (fixed position so horizontal toolbar scroll never clips them).
	let sizeMenuOpen = $state(false);
	let sizeTriggerEl = $state<HTMLButtonElement | null>(null);
	let sizeMenuEl = $state<HTMLDivElement | null>(null);
	let sizeMenuPos = $state({ top: 0, left: 0 });

	let spacingMenuOpen = $state(false);
	let spacingTriggerEl = $state<HTMLButtonElement | null>(null);
	let spacingMenuEl = $state<HTMLDivElement | null>(null);
	let spacingMenuPos = $state({ top: 0, left: 0 });

	let sizeDraft = $state('');

	$effect(() => {
		if (effectiveStyle) {
			sizeDraft = String(Math.round(effectiveStyle.fontSize));
		}
	});

	function openSizeMenu() {
		spacingMenuOpen = false;
		if (sizeMenuOpen) {
			sizeMenuOpen = false;
			return;
		}
		if (sizeTriggerEl && typeof window !== 'undefined') {
			const rect = sizeTriggerEl.getBoundingClientRect();
			const menuW = 96;
			sizeMenuPos = {
				top: Math.round(rect.bottom + 6),
				left: Math.max(8, Math.min(Math.round(rect.right - menuW), window.innerWidth - menuW - 8))
			};
		}
		sizeMenuOpen = true;
	}

	function openSpacingMenu() {
		sizeMenuOpen = false;
		if (spacingMenuOpen) {
			spacingMenuOpen = false;
			return;
		}
		if (spacingTriggerEl && typeof window !== 'undefined') {
			const rect = spacingTriggerEl.getBoundingClientRect();
			const menuW = 264;
			spacingMenuPos = {
				top: Math.round(rect.bottom + 6),
				left: Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - menuW - 8))
			};
		}
		spacingMenuOpen = true;
	}

	function applyFontFamily(nextFont: string) {
		if (!selectedTextEl) return;
		ensureFontLoaded(nextFont);
		if (activeSel) {
			activeSel.apply({ kind: 'font', value: nextFont }, { restoreFocus: true });
			return;
		}
		const previewText = stripRichTextMarkup(
			resolveElementText(selectedTextEl, sampleData, editor.previewMode)
		);
		const nextBox = scaleBoxForFontFamilyChange(
			{
				x: selectedTextEl.x,
				y: selectedTextEl.y,
				width: selectedTextEl.width,
				height: selectedTextEl.height
			},
			previewText,
			selectedTextEl.fontFamily,
			nextFont,
			selectedTextEl.fontSize,
			selectedTextEl.fontWeight,
			selectedTextEl.fontStyle,
			selectedTextEl.lineHeight,
			{ width: editor.width, height: editor.height }
		);
		editor.updateElement(selectedTextEl.id, { fontFamily: nextFont, ...nextBox });
	}

	function applyFontSize(rawPx: number, options?: { restoreFocus?: boolean }) {
		if (!selectedTextEl || !Number.isFinite(rawPx)) return;
		const nextPx = Math.max(8, Math.min(240, Math.round(rawPx)));
		sizeDraft = String(nextPx);

		if (activeSel) {
			activeSel.apply(
				{ kind: 'size', value: nextPx },
				{ restoreFocus: options?.restoreFocus ?? true }
			);
			// Naturally grow the box height around its centre if the updated multi-line text exceeds box height.
			const updatedEl = editor.selectedElement;
			const targetEl =
				updatedEl &&
				(updatedEl.type === 'text' || updatedEl.type === 'placeholder' || updatedEl.type === 'title')
					? updatedEl
					: selectedTextEl;
			const lh = Math.max(1, targetEl.lineHeight || 1.2);
			let naturalHeight = nextPx * lh;
			if (targetEl.type === 'text') {
				const runs = parseRichTextRuns(targetEl.text, {
					fontFamily: targetEl.fontFamily,
					fontSize: targetEl.fontSize,
					fontWeight: targetEl.fontWeight,
					fontStyle: targetEl.fontStyle,
					underline: targetEl.textDecoration === 'underline',
					fill: targetEl.fill
				});
				let lineMax = targetEl.fontSize;
				let total = 0;
				for (const run of runs) {
					const parts = run.text.split('\n');
					for (let i = 0; i < parts.length; i++) {
						if (i > 0) {
							total += lineMax * lh;
							lineMax = targetEl.fontSize;
						}
						if (parts[i].length > 0) {
							lineMax = Math.max(lineMax, run.fontSize);
						}
					}
				}
				total += lineMax * lh;
				naturalHeight = Math.max(naturalHeight, total);
			}
			const neededHeight = Math.round(naturalHeight * 1.15);
			if (neededHeight > targetEl.height) {
				const clampedH = Math.min(editor.height, neededHeight);
				const cy = targetEl.y + targetEl.height / 2;
				const nextY = Math.max(
					0,
					Math.min(editor.height - clampedH, Math.round(cy - clampedH / 2))
				);
				editor.updateElement(targetEl.id, { y: nextY, height: clampedH }, false);
			}
			return;
		}

		const nextBox = scaleBoxForFontSizeChange(
			{
				x: selectedTextEl.x,
				y: selectedTextEl.y,
				width: selectedTextEl.width,
				height: selectedTextEl.height
			},
			selectedTextEl.fontSize,
			nextPx,
			selectedTextEl.lineHeight,
			{ width: editor.width, height: editor.height }
		);
		editor.updateElement(selectedTextEl.id, { fontSize: nextPx, ...nextBox });
	}

	function applyColor(nextColor: string) {
		if (!selectedTextEl) return;
		if (activeSel) {
			activeSel.apply({ kind: 'color', value: nextColor }, { restoreFocus: false });
			return;
		}
		editor.updateElement(selectedTextEl.id, { fill: nextColor });
	}

	function toggleBold() {
		if (!selectedTextEl) return;
		if (activeSel) {
			activeSel.apply({ kind: 'bold' }, { restoreFocus: true });
			return;
		}
		editor.updateElement(selectedTextEl.id, {
			fontWeight: selectedTextEl.fontWeight >= 600 ? 400 : 700
		});
	}

	function toggleItalic() {
		if (!selectedTextEl) return;
		if (activeSel) {
			activeSel.apply({ kind: 'italic' }, { restoreFocus: true });
			return;
		}
		editor.updateElement(selectedTextEl.id, {
			fontStyle: selectedTextEl.fontStyle === 'italic' ? 'normal' : 'italic'
		});
	}

	function toggleUnderline() {
		if (!selectedTextEl) return;
		if (activeSel) {
			activeSel.apply({ kind: 'underline' }, { restoreFocus: true });
			return;
		}
		editor.updateElement(selectedTextEl.id, {
			textDecoration: selectedTextEl.textDecoration === 'underline' ? '' : 'underline'
		});
	}

	function clearFormatting() {
		if (!selectedTextEl) return;
		if (activeSel) {
			activeSel.apply({ kind: 'clear' }, { restoreFocus: true });
			return;
		}
		if (selectedTextEl.type === 'text') {
			const cleanedText = stripRichTextMarkup(selectedTextEl.text);
			const cleanedRules = selectedTextEl.rules?.map((r) => ({
				...r,
				output: stripRichTextMarkup(r.output)
			}));
			editor.updateElement(selectedTextEl.id, {
				text: cleanedText,
				...(cleanedRules ? { rules: cleanedRules } : {})
			});
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		const target = event.target as Node | null;
		if (
			sizeMenuOpen &&
			target &&
			!sizeMenuEl?.contains(target) &&
			!sizeTriggerEl?.contains(target)
		) {
			sizeMenuOpen = false;
		}
		if (
			spacingMenuOpen &&
			target &&
			!spacingMenuEl?.contains(target) &&
			!spacingTriggerEl?.contains(target)
		) {
			spacingMenuOpen = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			sizeMenuOpen = false;
			spacingMenuOpen = false;
		}
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div
	role="toolbar"
	aria-label="Editor formatting toolbar"
	class="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border-default bg-surface-card px-3 sm:px-4"
>
	{#if selectedTextEl && effectiveStyle}
		<!-- Highlighted Words Indicator Pill -->
		{#if activeSel}
			<div
				class="flex shrink-0 items-center gap-1 rounded-full border border-tone-editor-border bg-tone-editor-soft py-0.5 pr-1 pl-2.5 text-[11px] font-semibold text-tone-editor-ink"
				title="Formatting applies only to the highlighted words inside {activeSel.label}"
			>
				<span class="max-w-32 truncate">
					{activeSel.label}: "{stripRichTextMarkup(activeSel.selectedText).replace(/\s+/g, ' ')}"
				</span>
				<button
					type="button"
					title="Switch back to editing the whole text element"
					aria-label="Clear highlighted word selection"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => activeSel.clear()}
					class="cursor-pointer rounded-full p-0.5 hover:opacity-75"
				>
					<X class="h-3 w-3" />
				</button>
			</div>
			<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		{/if}

		<!-- Font Family -->
		<FontPicker
			id="toolbar-font"
			compact
			title={activeSel ? 'Change font of highlighted words' : 'Change font of text element'}
			value={effectiveStyle.fontFamily}
			onSelect={applyFontFamily}
		/>

		<!-- Font Size (- / input / presets / +) -->
		<div
			class="flex h-[30px] shrink-0 items-center overflow-hidden rounded-md border border-border-strong bg-surface-card transition focus-within:border-accent-vivid focus-within:ring-3 focus-within:ring-accent-vivid/18 dark:bg-surface-recessed"
			title={activeSel ? 'Change font size of highlighted words' : 'Change font size of text element'}
		>
			<button
				type="button"
				aria-label="Decrease font size"
				onmousedown={(e) => e.preventDefault()}
				onclick={() => applyFontSize(effectiveStyle.fontSize - 1, { restoreFocus: true })}
				class="flex h-full w-6 cursor-pointer items-center justify-center text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
			>
				<Minus class="h-3 w-3" />
			</button>
			<input
				type="number"
				aria-label="Font size in pixels"
				min={8}
				max={240}
				bind:value={sizeDraft}
				onchange={() => {
					const parsed = Number(sizeDraft);
					if (Number.isFinite(parsed) && parsed >= 8) {
						applyFontSize(parsed, { restoreFocus: false });
					} else {
						sizeDraft = String(Math.round(effectiveStyle.fontSize));
					}
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						const parsed = Number(sizeDraft);
						if (Number.isFinite(parsed) && parsed >= 8) {
							applyFontSize(parsed, { restoreFocus: true });
						}
					}
				}}
				class="h-full w-11 border-x border-border-default bg-transparent text-center font-mono text-xs font-medium text-ink-primary tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
			/>
			<button
				bind:this={sizeTriggerEl}
				type="button"
				aria-label="Font size presets"
				aria-expanded={sizeMenuOpen}
				onmousedown={(e) => e.preventDefault()}
				onclick={openSizeMenu}
				class="flex h-full w-5 cursor-pointer items-center justify-center border-r border-border-default text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
			>
				<ChevronDown class="h-3 w-3" />
			</button>
			<button
				type="button"
				aria-label="Increase font size"
				onmousedown={(e) => e.preventDefault()}
				onclick={() => applyFontSize(effectiveStyle.fontSize + 1, { restoreFocus: true })}
				class="flex h-full w-6 cursor-pointer items-center justify-center text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
			>
				<Plus class="h-3 w-3" />
			</button>
		</div>

		<!-- Text Colour -->
		<label
			class="flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-2 transition hover:border-ink-muted/60 dark:bg-surface-recessed"
			title={activeSel ? 'Change colour of highlighted words' : 'Change text colour'}
		>
			<input
				type="color"
				aria-label={activeSel ? 'Highlighted words colour' : 'Text colour'}
				value={effectiveStyle.fill}
				oninput={(e) => applyColor(e.currentTarget.value)}
				class="h-4 w-4 cursor-pointer rounded border border-border-default bg-transparent p-0"
			/>
			<span class="hidden font-mono text-[11px] text-ink-secondary uppercase xl:inline">
				{effectiveStyle.fill}
			</span>
		</label>

		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>

		<!-- Bold / Italic / Underline / Clear Formatting -->
		<div class="flex shrink-0 items-center gap-0.5 rounded-lg border border-border-default bg-surface-subtle p-0.5 dark:bg-surface-recessed">
			<button
				type="button"
				title={activeSel ? 'Bold highlighted words (Ctrl+B)' : 'Bold'}
				aria-label="Bold"
				aria-pressed={effectiveStyle.fontWeight >= 600}
				onmousedown={(e) => e.preventDefault()}
				onclick={toggleBold}
				class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-xs transition {effectiveStyle.fontWeight >=
				600
					? 'bg-tone-editor-soft text-tone-editor-ink shadow-xs ring-1 ring-tone-editor-border'
					: 'text-ink-secondary hover:bg-surface-card/60 hover:text-ink-primary'}"
			>
				<Bold class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				title={activeSel ? 'Italic highlighted words (Ctrl+I)' : 'Italic'}
				aria-label="Italic"
				aria-pressed={effectiveStyle.fontStyle === 'italic'}
				onmousedown={(e) => e.preventDefault()}
				onclick={toggleItalic}
				class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-xs transition {effectiveStyle.fontStyle ===
				'italic'
					? 'bg-tone-editor-soft text-tone-editor-ink shadow-xs ring-1 ring-tone-editor-border'
					: 'text-ink-secondary hover:bg-surface-card/60 hover:text-ink-primary'}"
			>
				<Italic class="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				title={activeSel ? 'Underline highlighted words (Ctrl+U)' : 'Underline'}
				aria-label="Underline"
				aria-pressed={effectiveStyle.underline}
				onmousedown={(e) => e.preventDefault()}
				onclick={toggleUnderline}
				class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-xs transition {effectiveStyle.underline
					? 'bg-tone-editor-soft text-tone-editor-ink shadow-xs ring-1 ring-tone-editor-border'
					: 'text-ink-secondary hover:bg-surface-card/60 hover:text-ink-primary'}"
			>
				<Underline class="h-3.5 w-3.5" />
			</button>

			{#if activeSel || hasAnyInlineMarkup}
				<button
					type="button"
					title={activeSel ? 'Clear formatting from highlighted words' : 'Clear all inline formatting'}
					aria-label="Clear inline formatting"
					onmousedown={(e) => e.preventDefault()}
					onclick={clearFormatting}
					class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-ink-muted transition hover:bg-surface-card/60 hover:text-ink-primary"
				>
					<RemoveFormatting class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>

		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>

		<!-- Horizontal Alignment -->
		<div
			class="flex shrink-0 items-center gap-0.5 rounded-lg border border-border-default bg-surface-subtle p-0.5 dark:bg-surface-recessed"
			role="group"
			aria-label="Horizontal text alignment"
		>
			{#each alignOptions as opt (opt.value)}
				<button
					type="button"
					title={opt.label}
					aria-label={opt.label}
					aria-pressed={selectedTextEl.align === opt.value}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => editor.updateElement(selectedTextEl.id, { align: opt.value })}
					class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-xs transition {selectedTextEl.align ===
					opt.value
						? 'bg-surface-card text-ink-primary shadow-xs dark:bg-surface-elevated'
						: 'text-ink-secondary hover:text-ink-primary'}"
				>
					{#if opt.value === 'left'}
						<AlignLeft class="h-3.5 w-3.5" />
					{:else if opt.value === 'center'}
						<AlignCenter class="h-3.5 w-3.5" />
					{:else if opt.value === 'right'}
						<AlignRight class="h-3.5 w-3.5" />
					{:else}
						<AlignJustify class="h-3.5 w-3.5" />
					{/if}
				</button>
			{/each}
		</div>

		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>

		<!-- Vertical Alignment -->
		<div
			class="flex shrink-0 items-center gap-0.5 rounded-lg border border-border-default bg-surface-subtle p-0.5 dark:bg-surface-recessed"
			role="group"
			aria-label="Vertical text alignment"
		>
			{#each vAlignOptions as opt (opt.value)}
				<button
					type="button"
					title={opt.label}
					aria-label={opt.label}
					aria-pressed={selectedTextEl.verticalAlign === opt.value}
					onmousedown={(e) => e.preventDefault()}
					onclick={() => editor.updateElement(selectedTextEl.id, { verticalAlign: opt.value })}
					class="flex h-[26px] w-7 cursor-pointer items-center justify-center rounded-[5px] text-xs transition {selectedTextEl.verticalAlign ===
					opt.value
						? 'bg-surface-card text-ink-primary shadow-xs dark:bg-surface-elevated'
						: 'text-ink-secondary hover:text-ink-primary'}"
				>
					{#if opt.value === 'top'}
						<ArrowUpToLine class="h-3.5 w-3.5" />
					{:else if opt.value === 'middle'}
						<FoldVertical class="h-3.5 w-3.5" />
					{:else}
						<ArrowDownToLine class="h-3.5 w-3.5" />
					{/if}
				</button>
			{/each}
		</div>

		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>

		<!-- Text Case -->
		<select
			aria-label="Text case"
			title="Text case"
			value={selectedTextEl.textTransform}
			onchange={(e) =>
				editor.updateElement(selectedTextEl.id, {
					textTransform: e.currentTarget.value as TextTransformMode
				})}
			class="h-[30px] shrink-0 rounded-md border border-border-strong bg-surface-card px-2 text-xs text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
		>
			{#each transformOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>

		<!-- Spacing, Wrap & Auto-Fit Popover -->
		<button
			bind:this={spacingTriggerEl}
			type="button"
			title="Line height, letter spacing, word wrap and auto-fit"
			aria-expanded={spacingMenuOpen}
			onmousedown={(e) => e.preventDefault()}
			onclick={openSpacingMenu}
			class="cf-pressable inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium {spacingMenuOpen
				? 'border-accent-border bg-accent-soft text-accent-ink'
				: 'border-border-strong bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
		>
			<SlidersHorizontal class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Spacing</span>
			<ChevronDown class="h-3 w-3 opacity-70" />
		</button>

		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>

		<!-- Quick Canvas Centre Controls -->
		<div class="flex shrink-0 items-center gap-1.5" role="group" aria-label="Centre element on canvas">
			<span class="text-[11px] font-medium text-ink-muted">Centre:</span>
			<div
				class="inline-flex h-[30px] shrink-0 items-center divide-x divide-border-default overflow-hidden rounded-md border border-border-default bg-surface-card"
			>
				<button
					type="button"
					title="Centre element horizontally on canvas"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => editor.alignElementOnCanvas(selectedTextEl.id, 'center-x')}
					class="h-full cursor-pointer px-2 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Horizontal
				</button>
				<button
					type="button"
					title="Centre element vertically on canvas"
					onmousedown={(e) => e.preventDefault()}
					onclick={() => editor.alignElementOnCanvas(selectedTextEl.id, 'center-y')}
					class="h-full cursor-pointer px-2 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Vertical
				</button>
			</div>
		</div>
	{:else if editor.selectedElements.length > 1}
		<span
			class="shrink-0 rounded-full border border-tone-editor-border bg-tone-editor-soft px-2.5 py-0.5 text-xs font-semibold text-tone-editor-ink tabular-nums"
		>
			{editor.selectedElements.length} selected
		</span>
		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		<div class="flex shrink-0 items-center gap-1">
			{#each [
				{ id: 'left' as const, label: 'Left' },
				{ id: 'center-x' as const, label: 'Centre' },
				{ id: 'right' as const, label: 'Right' },
				{ id: 'top' as const, label: 'Top' },
				{ id: 'center-y' as const, label: 'Middle' },
				{ id: 'bottom' as const, label: 'Bottom' }
			] as act (act.id)}
				<button
					type="button"
					onclick={() => editor.alignSelectedElements(act.id)}
					class="cf-pressable h-[30px] cursor-pointer rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					{act.label}
				</button>
			{/each}
		</div>
		{#if editor.selectedElements.length >= 3}
			<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
			<button
				type="button"
				onclick={() => editor.alignSelectedElements('distribute-h')}
				class="cf-pressable h-[30px] shrink-0 cursor-pointer rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
			>
				Space H
			</button>
			<button
				type="button"
				onclick={() => editor.alignSelectedElements('distribute-v')}
				class="cf-pressable h-[30px] shrink-0 cursor-pointer rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
			>
				Space V
			</button>
		{/if}
		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		<button
			type="button"
			disabled={!editor.canGroup}
			onclick={() => editor.groupSelected()}
			class="cf-pressable inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-tone-editor-border bg-tone-editor-soft px-2.5 text-xs font-semibold text-tone-editor-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
		>
			<Group class="h-3.5 w-3.5" />
			Group
		</button>
		<button
			type="button"
			disabled={!editor.canUngroup}
			onclick={() => editor.ungroupSelected()}
			class="cf-pressable inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-45"
		>
			<Ungroup class="h-3.5 w-3.5" />
			Ungroup
		</button>
	{:else if selected}
		<span class="shrink-0 rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-ink-secondary capitalize">
			{selected.type}
		</span>
		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		<button
			type="button"
			onclick={() => editor.alignElementOnCanvas(selected.id, 'left')}
			class="cf-pressable h-[30px] shrink-0 cursor-pointer rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
		>
			Align Left
		</button>
		<button
			type="button"
			onclick={() => editor.alignElementOnCanvas(selected.id, 'right')}
			class="cf-pressable h-[30px] shrink-0 cursor-pointer rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
		>
			Align Right
		</button>
		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		<div class="flex shrink-0 items-center gap-1.5" role="group" aria-label="Centre element on canvas">
			<span class="text-[11px] font-medium text-ink-muted">Centre:</span>
			<div
				class="inline-flex h-[30px] shrink-0 items-center divide-x divide-border-default overflow-hidden rounded-md border border-border-default bg-surface-card"
			>
				<button
					type="button"
					onclick={() => editor.alignElementOnCanvas(selected.id, 'center-x')}
					class="h-full cursor-pointer px-2 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Horizontal
				</button>
				<button
					type="button"
					onclick={() => editor.alignElementOnCanvas(selected.id, 'center-y')}
					class="h-full cursor-pointer px-2 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Vertical
				</button>
			</div>
		</div>
		<div class="mx-0.5 h-[18px] w-px shrink-0 bg-border-default"></div>
		<button
			type="button"
			title="Duplicate element"
			onclick={() => editor.duplicateElement(selected.id)}
			class="cf-pressable inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 text-xs text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
		>
			<Copy class="h-3.5 w-3.5" />
			Duplicate
		</button>
		<button
			type="button"
			title="Delete element"
			onclick={() => editor.deleteElement(selected.id)}
			class="cf-pressable inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-md border border-tone-danger-border bg-tone-danger-soft px-2 text-xs font-medium text-tone-danger-ink hover:opacity-90"
		>
			<Trash2 class="h-3.5 w-3.5" />
			Delete
		</button>
	{:else}
		<p class="truncate text-xs text-ink-muted">
			Select a text element to format font, size, colour and alignment, or double-click text on the
			canvas to type and style individual words.
		</p>
		<span class="ml-auto shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
			{editor.width} × {editor.height} px
		</span>
	{/if}
</div>

<!-- Fixed Font Size Preset Popover -->
{#if sizeMenuOpen && selectedTextEl && effectiveStyle}
	<div
		bind:this={sizeMenuEl}
		role="listbox"
		aria-label="Choose font size"
		style="top: {sizeMenuPos.top}px; left: {sizeMenuPos.left}px;"
		class="cf-popover-in fixed z-50 max-h-64 w-24 overflow-y-auto rounded-xl border border-border-default bg-surface-elevated p-1 shadow-md"
	>
		{#each FONT_SIZE_PRESETS as px (px)}
			<button
				type="button"
				role="option"
				aria-selected={Math.round(effectiveStyle.fontSize) === px}
				onmousedown={(e) => e.preventDefault()}
				onclick={() => {
					sizeMenuOpen = false;
					applyFontSize(px, { restoreFocus: true });
				}}
				class="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 font-mono text-xs tabular-nums transition {Math.round(
					effectiveStyle.fontSize
				) === px
					? 'bg-tone-editor-soft font-semibold text-tone-editor-ink'
					: 'text-ink-primary hover:bg-surface-subtle'}"
			>
				<span>{px}</span>
				<span class="text-[10px] text-ink-muted">px</span>
			</button>
		{/each}
	</div>
{/if}

<!-- Fixed Spacing, Wrap & Auto-Fit Popover -->
{#if spacingMenuOpen && selectedTextEl}
	<div
		bind:this={spacingMenuEl}
		role="dialog"
		aria-label="Text spacing and wrap settings"
		style="top: {spacingMenuPos.top}px; left: {spacingMenuPos.left}px;"
		class="cf-popover-in fixed z-50 w-66 space-y-3 rounded-xl border border-border-default bg-surface-elevated p-3 shadow-md"
	>
		<div class="grid grid-cols-2 gap-2">
			<ScrubNumberInput
				id="toolbar-line-height"
				label="Line Height"
				min={0.8}
				max={3}
				step={0.05}
				pixelsPerStep={6}
				value={selectedTextEl.lineHeight}
				onScrubStart={() => editor.pushHistorySnapshot()}
				onValueChange={(next, { scrubbing }) =>
					editor.updateElement(selectedTextEl.id, { lineHeight: next }, !scrubbing)}
			/>
			<ScrubNumberInput
				id="toolbar-letter-spacing"
				label="Letter Spacing"
				min={-5}
				max={30}
				step={0.5}
				pixelsPerStep={4}
				value={selectedTextEl.letterSpacing}
				onScrubStart={() => editor.pushHistorySnapshot()}
				onValueChange={(next, { scrubbing }) =>
					editor.updateElement(selectedTextEl.id, { letterSpacing: next }, !scrubbing)}
			/>
		</div>

		<div>
			<label for="toolbar-wrap" class="block text-xs font-medium text-ink-secondary">
				Word Wrap
			</label>
			<select
				id="toolbar-wrap"
				value={selectedTextEl.wrap}
				onchange={(e) =>
					editor.updateElement(selectedTextEl.id, {
						wrap: e.currentTarget.value as TextWrapMode
					})}
				class="mt-1 block h-[30px] w-full rounded-md border border-border-strong bg-surface-card px-2 text-xs text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
			>
				{#each wrapOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="space-y-1.5 border-t border-border-subtle pt-2">
			<label class="flex cursor-pointer items-center gap-2 text-xs text-ink-primary">
				<input
					type="checkbox"
					checked={selectedTextEl.autoFit}
					onchange={(e) =>
						editor.updateElement(selectedTextEl.id, { autoFit: e.currentTarget.checked })}
					class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
				/>
				Auto-Fit Long Text
			</label>
			<label class="flex cursor-pointer items-center gap-2 text-xs text-ink-primary">
				<input
					type="checkbox"
					checked={selectedTextEl.ellipsis}
					onchange={(e) =>
						editor.updateElement(selectedTextEl.id, { ellipsis: e.currentTarget.checked })}
					class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
				/>
				Ellipsis on Overflow
			</label>
		</div>
	</div>
{/if}
