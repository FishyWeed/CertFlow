<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { CriterionDefinition } from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import {
		applyInlineFormatToSelection,
		stripRichTextMarkup,
		type InlineFormatAction
	} from './rich-text.ts';

	interface Props {
		id: string;
		value: string;
		editor: EditorState;
		elementId: string;
		fieldLabel: string;
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
		placeholder = '',
		rows = 3,
		criteria,
		compact = false,
		onChange
	}: Props = $props();

	let textAreaEl = $state<HTMLTextAreaElement | null>(null);
	// Preserve selection coordinates across focus shifts to the top EditorToolbar.
	let savedSelection = $state<{ start: number; end: number } | null>(null);
	let latestText = '';

	$effect(() => {
		latestText = value;
	});

	const isSelectionActive = $derived(
		editor.activeTextSelection?.fieldId === id &&
			editor.activeTextSelection?.elementId === elementId
	);

	function publishSelection(text: string, start: number, end: number) {
		const from = Math.max(0, Math.min(text.length, Math.min(start, end)));
		const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
		savedSelection = { start: from, end: to };

		if (to > from) {
			editor.setActiveTextSelection({
				elementId,
				fieldId: id,
				label: fieldLabel,
				text,
				start: from,
				end: to,
				selectedText: text.slice(from, to),
				apply: applyFormat,
				clear: clearHighlight
			});
		} else {
			editor.clearActiveTextSelection(id);
		}
	}

	function syncSelectionFromTextarea() {
		if (!textAreaEl) return;
		const text = textAreaEl.value;
		latestText = text;
		const start = textAreaEl.selectionStart ?? text.length;
		const end = textAreaEl.selectionEnd ?? text.length;
		publishSelection(text, start, end);
	}

	function getActiveSelection(): { start: number; end: number } {
		const text = latestText;
		if (textAreaEl && document.activeElement === textAreaEl) {
			return {
				start: textAreaEl.selectionStart ?? text.length,
				end: textAreaEl.selectionEnd ?? text.length
			};
		}
		if (savedSelection) {
			return {
				start: Math.max(0, Math.min(text.length, savedSelection.start)),
				end: Math.max(0, Math.min(text.length, savedSelection.end))
			};
		}
		return { start: text.length, end: text.length };
	}

	function clearHighlight() {
		savedSelection = null;
		editor.clearActiveTextSelection(id);
		if (textAreaEl && document.activeElement === textAreaEl) {
			const end = textAreaEl.selectionEnd ?? textAreaEl.value.length;
			textAreaEl.setSelectionRange(end, end);
		}
	}

	function applyFormat(action: InlineFormatAction, options?: { restoreFocus?: boolean }) {
		const currentText = latestText;
		const { start, end } = getActiveSelection();
		const next = applyInlineFormatToSelection(currentText, start, end, action);
		latestText = next.text;
		onChange(next.text);
		publishSelection(next.text, next.selectionStart, next.selectionEnd);

		if (options?.restoreFocus !== false) {
			requestAnimationFrame(() => {
				if (!textAreaEl) return;
				textAreaEl.focus();
				textAreaEl.setSelectionRange(next.selectionStart, next.selectionEnd);
			});
		}
	}

	function insertToken(token: string) {
		const currentText = latestText;
		const { start, end } = getActiveSelection();
		const before = currentText.slice(0, start);
		const after = currentText.slice(end);
		const needsLeadingSpace =
			before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') && !before.endsWith('>');
		const inserted = `${needsLeadingSpace ? ' ' : ''}${token}`;
		const nextText = before + inserted + after;
		const nextCursor = before.length + inserted.length;
		latestText = nextText;
		onChange(nextText);
		publishSelection(nextText, nextCursor, nextCursor);
		requestAnimationFrame(() => {
			if (!textAreaEl) return;
			textAreaEl.focus();
			textAreaEl.setSelectionRange(nextCursor, nextCursor);
		});
	}

	onDestroy(() => {
		editor.clearActiveTextSelection(id);
	});
</script>

<div class="space-y-1.5">
	<textarea
		bind:this={textAreaEl}
		{id}
		{rows}
		{value}
		{placeholder}
		oninput={(e) => {
			const nextVal = e.currentTarget.value;
			latestText = nextVal;
			onChange(nextVal);
			publishSelection(
				nextVal,
				e.currentTarget.selectionStart ?? nextVal.length,
				e.currentTarget.selectionEnd ?? nextVal.length
			);
		}}
		onselect={syncSelectionFromTextarea}
		onmouseup={syncSelectionFromTextarea}
		onkeyup={syncSelectionFromTextarea}
		onkeydown={(e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
				e.preventDefault();
				syncSelectionFromTextarea();
				applyFormat({ kind: 'bold' });
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
				e.preventDefault();
				syncSelectionFromTextarea();
				applyFormat({ kind: 'italic' });
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
				e.preventDefault();
				syncSelectionFromTextarea();
				applyFormat({ kind: 'underline' });
			}
		}}
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
			const ta = e.currentTarget;
			const start = ta.selectionStart ?? latestText.length;
			const end = ta.selectionEnd ?? latestText.length;
			const nextText = latestText.slice(0, start) + token + latestText.slice(end);
			const nextCursor = start + token.length;
			latestText = nextText;
			onChange(nextText);
			publishSelection(nextText, nextCursor, nextCursor);
		}}
		class="block w-full resize-y rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none transition {isSelectionActive
			? 'border-accent ring-2 ring-indigo-200/80'
			: 'border-border-strong focus:border-accent'}"
	></textarea>

	{#if isSelectionActive && editor.activeTextSelection}
		<p class="text-[11px] font-medium text-indigo-700">
			Selected "{stripRichTextMarkup(editor.activeTextSelection.selectedText).replace(/\s+/g, ' ')}"
			— use the top toolbar to change font, size, colour or style.
		</p>
	{/if}

	<!-- Quick {{property}} insert chips -->
	<div class="flex flex-wrap gap-1">
		{#each criteria as prop (prop.key)}
			<button
				type="button"
				onmousedown={(e) => {
					e.preventDefault();
					syncSelectionFromTextarea();
				}}
				onclick={() => insertToken(`{{${prop.key}}}`)}
				class="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-indigo-700 hover:bg-indigo-100 {compact
					? 'text-[10px]'
					: 'text-[11px]'}"
			>
				{`{{${prop.key}}}`}
			</button>
		{/each}
	</div>
</div>
