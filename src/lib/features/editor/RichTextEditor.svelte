<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CriterionDefinition } from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import { ensureFontLoaded, quoteFontFamily } from './fonts.ts';
	import {
		stripRichTextMarkup,
		type InlineFormatAction,
		type RichTextStyle
	} from './rich-text.ts';
	import {
		applyFormatToPlainRange,
		domToRichTextMarkup,
		getPlainTextSelection,
		inspectPlainRangeStyle,
		richTextMarkupToHtml,
		setPlainTextSelection
	} from './wysiwyg.ts';

	interface Props {
		id: string;
		value: string;
		editor: EditorState;
		elementId: string;
		fieldLabel: string;
		baseStyle: RichTextStyle;
		placeholder?: string;
		rows?: number;
		criteria: CriterionDefinition[];
		compact?: boolean;
		onChange: (nextValue: string) => void;
	}

	let {
		id,
		value,
		editor,
		elementId,
		fieldLabel,
		baseStyle,
		placeholder = '',
		rows = 3,
		criteria,
		compact = false,
		onChange
	}: Props = $props();

	let editableEl = $state<HTMLDivElement | null>(null);
	let savedSelection = $state<{ start: number; end: number } | null>(null);
	let latestMarkup = '';
	let lastSyncedHtml = '';

	const isSelectionActive = $derived(
		editor.activeTextSelection?.fieldId === id &&
			editor.activeTextSelection?.elementId === elementId
	);

	// Keep WYSIWYG HTML in sync whenever `value` or element `baseStyle` changes externally.
	$effect(() => {
		latestMarkup = value;
		if (!editableEl) return;
		const desiredHtml = richTextMarkupToHtml(value, baseStyle, { compactSidebar: true });
		if (desiredHtml === lastSyncedHtml) return;
		const wasFocused = document.activeElement === editableEl;
		const prevSel = wasFocused ? getPlainTextSelection(editableEl) : null;
		editableEl.innerHTML = desiredHtml;
		lastSyncedHtml = desiredHtml;
		if (wasFocused && prevSel) {
			setPlainTextSelection(editableEl, prevSel.start, prevSel.end);
		}
	});

	function publishSelection(markup: string, start: number, end: number) {
		const plain = stripRichTextMarkup(markup);
		const from = Math.max(0, Math.min(plain.length, Math.min(start, end)));
		const to = Math.max(from, Math.min(plain.length, Math.max(start, end)));
		savedSelection = { start: from, end: to };

		if (to > from) {
			editor.setActiveTextSelection({
				elementId,
				fieldId: id,
				label: fieldLabel,
				text: markup,
				start: from,
				end: to,
				selectedText: plain.slice(from, to),
				effectiveStyle: inspectPlainRangeStyle(markup, baseStyle, from, to),
				apply: applyFormat,
				clear: clearHighlight
			});
		} else {
			editor.clearActiveTextSelection(id);
		}
	}

	function syncSelectionFromDom() {
		if (!editableEl) return;
		const sel = getPlainTextSelection(editableEl);
		if (!sel) return;
		publishSelection(latestMarkup, sel.start, sel.end);
	}

	function getActiveSelection(): { start: number; end: number } {
		const plainLen = stripRichTextMarkup(latestMarkup).length;
		if (editableEl && document.activeElement === editableEl) {
			const live = getPlainTextSelection(editableEl);
			if (live) return live;
		}
		if (savedSelection) {
			return {
				start: Math.max(0, Math.min(plainLen, savedSelection.start)),
				end: Math.max(0, Math.min(plainLen, savedSelection.end))
			};
		}
		return { start: plainLen, end: plainLen };
	}

	function clearHighlight() {
		savedSelection = null;
		editor.clearActiveTextSelection(id);
		if (editableEl && document.activeElement === editableEl) {
			const live = getPlainTextSelection(editableEl);
			if (live) setPlainTextSelection(editableEl, live.end, live.end);
		}
	}

	function applyFormat(action: InlineFormatAction, options?: { restoreFocus?: boolean }) {
		if (action.kind === 'font') ensureFontLoaded(action.value);
		const { start, end } = getActiveSelection();
		const nextMarkup = applyFormatToPlainRange(latestMarkup, baseStyle, start, end, action);
		latestMarkup = nextMarkup;

		if (editableEl) {
			const nextHtml = richTextMarkupToHtml(nextMarkup, baseStyle, { compactSidebar: true });
			editableEl.innerHTML = nextHtml;
			lastSyncedHtml = nextHtml;
		}

		onChange(nextMarkup);
		publishSelection(nextMarkup, start, end);

		if (options?.restoreFocus !== false) {
			requestAnimationFrame(() => {
				if (!editableEl) return;
				editableEl.focus();
				setPlainTextSelection(editableEl, start, end);
			});
		}
	}

	function insertPlainTextAtSelection(inserted: string) {
		const plain = stripRichTextMarkup(latestMarkup);
		const { start, end } = getActiveSelection();
		const beforePlain = plain.slice(0, start);
		const needsLeadingSpace =
			inserted.startsWith('{{') &&
			beforePlain.length > 0 &&
			!beforePlain.endsWith(' ') &&
			!beforePlain.endsWith('\n');
		const finalInsert = `${needsLeadingSpace ? ' ' : ''}${inserted}`;

		if (editableEl) {
			editableEl.focus();
			setPlainTextSelection(editableEl, start, end);
			const sel = window.getSelection();
			if (sel && sel.rangeCount > 0) {
				const range = sel.getRangeAt(0);
				range.deleteContents();
				const textNode = document.createTextNode(finalInsert);
				range.insertNode(textNode);
				range.setStartAfter(textNode);
				range.setEndAfter(textNode);
				sel.removeAllRanges();
				sel.addRange(range);
				const nextMarkup = domToRichTextMarkup(editableEl, baseStyle);
				latestMarkup = nextMarkup;
				lastSyncedHtml = editableEl.innerHTML;
				onChange(nextMarkup);
				const nextCaret = start + finalInsert.length;
				publishSelection(nextMarkup, nextCaret, nextCaret);
				return;
			}
		}

		const nextMarkup = latestMarkup + finalInsert;
		latestMarkup = nextMarkup;
		onChange(nextMarkup);
	}

	function handleInput() {
		if (!editableEl) return;
		const nextMarkup = domToRichTextMarkup(editableEl, baseStyle);
		latestMarkup = nextMarkup;
		lastSyncedHtml = editableEl.innerHTML;
		onChange(nextMarkup);
		syncSelectionFromDom();
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const plain = event.clipboardData?.getData('text/plain') ?? '';
		if (!plain) return;
		insertPlainTextAtSelection(plain);
	}

	function handleKeydown(event: KeyboardEvent) {
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		if (mod && key === 'b') {
			event.preventDefault();
			syncSelectionFromDom();
			applyFormat({ kind: 'bold' });
		} else if (mod && key === 'i') {
			event.preventDefault();
			syncSelectionFromDom();
			applyFormat({ kind: 'italic' });
		} else if (mod && key === 'u') {
			event.preventDefault();
			syncSelectionFromDom();
			applyFormat({ kind: 'underline' });
		}
	}

	onDestroy(() => {
		editor.clearActiveTextSelection(id);
	});
</script>

<div class="space-y-1.5">
	<div class="relative">
		{#if !stripRichTextMarkup(value) && placeholder}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-1.5 text-xs whitespace-pre-wrap text-ink-muted/70"
			>
				{placeholder}
			</div>
		{/if}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={editableEl}
			{id}
			role="textbox"
			tabindex={0}
			aria-multiline="true"
			aria-label={fieldLabel}
			contenteditable="true"
			spellcheck="true"
			style="min-height: {Math.max(44, rows * 20 + 14)}px; font-family: {quoteFontFamily(baseStyle.fontFamily)}, sans-serif; font-weight: {baseStyle.fontWeight}; font-style: {baseStyle.fontStyle};"
			oninput={handleInput}
			onmouseup={syncSelectionFromDom}
			onkeyup={syncSelectionFromDom}
			onpaste={handlePaste}
			onkeydown={handleKeydown}
			ondragover={(e) => {
				if (e.dataTransfer?.types.includes('text/plain')) {
					e.preventDefault();
					e.dataTransfer.dropEffect = 'copy';
				}
			}}
			ondrop={(e) => {
				const token = e.dataTransfer?.getData('text/plain');
				if (!token) return;
				e.preventDefault();
				insertPlainTextAtSelection(token);
			}}
			class="block w-full resize-y overflow-auto rounded-lg border bg-white px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap text-ink-primary outline-none transition {isSelectionActive
				? 'border-accent ring-2 ring-indigo-200/80'
				: 'border-border-strong focus:border-accent'}"
		></div>
	</div>

	{#if isSelectionActive && editor.activeTextSelection}
		<p class="text-[11px] font-medium text-indigo-700">
			Selected "{editor.activeTextSelection.selectedText.replace(/\s+/g, ' ')}" — use the top
			toolbar to change font, size, colour or style.
		</p>
	{/if}

	<!-- Quick {{property}} insert chips -->
	<div class="flex flex-wrap gap-1">
		{#each criteria as prop (prop.key)}
			<button
				type="button"
				onmousedown={(e) => {
					e.preventDefault();
					syncSelectionFromDom();
				}}
				onclick={() => insertPlainTextAtSelection(`{{${prop.key}}}`)}
				class="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-indigo-700 hover:bg-indigo-100 {compact
					? 'text-[10px]'
					: 'text-[11px]'}"
			>
				{`{{${prop.key}}}`}
			</button>
		{/each}
	</div>
</div>
