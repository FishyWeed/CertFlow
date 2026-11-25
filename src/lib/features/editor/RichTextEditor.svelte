<script lang="ts">
	import {
		Bold,
		ChevronDown,
		Italic,
		RemoveFormatting,
		Search,
		Type,
		Underline,
		X
	} from '@lucide/svelte';
	import {
		FONT_CATALOG,
		FONT_CATEGORIES,
		type FontCategory
	} from '#lib/config/canvas.ts';
	import type { CriterionDefinition } from '#lib/types/certflow.ts';
	import { ensureFontLoaded, ensureFontStylesheet, quoteFontFamily } from './fonts.ts';
	import { applyInlineFormatToSelection, type InlineFormatAction } from './rich-text.ts';

	interface Props {
		id: string;
		value: string;
		placeholder?: string;
		rows?: number;
		criteria: CriterionDefinition[];
		compact?: boolean;
		onChange: (nextValue: string) => void;
	}

	let {
		id,
		value,
		placeholder = '',
		rows = 3,
		criteria,
		compact = false,
		onChange
	}: Props = $props();

	let textAreaEl = $state<HTMLTextAreaElement | null>(null);
	let inlineColor = $state('#000000');
	// Preserve highlighted range even when a popover, colour input or dropdown takes focus.
	let savedSelection = $state<{ start: number; end: number } | null>(null);

	let fontMenuOpen = $state(false);
	let fontSearch = $state('');
	let fontCategory = $state<'all' | FontCategory>('all');
	let fontSearchEl = $state<HTMLInputElement | null>(null);
	let fontMenuRootEl = $state<HTMLDivElement | null>(null);
	let fontTriggerEl = $state<HTMLButtonElement | null>(null);
	let fontMenuPos = $state<{ top: number; left: number; width: number }>({
		top: 0,
		left: 0,
		width: 248
	});

	const INLINE_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

	const filteredFonts = $derived.by(() => {
		const q = fontSearch.trim().toLowerCase();
		return FONT_CATALOG.filter((f) => {
			if (fontCategory !== 'all' && f.category !== fontCategory) return false;
			if (q && !f.family.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	function captureSelection() {
		if (!textAreaEl) return;
		savedSelection = {
			start: textAreaEl.selectionStart ?? value.length,
			end: textAreaEl.selectionEnd ?? value.length
		};
	}

	function getActiveSelection(): { start: number; end: number } {
		if (textAreaEl && document.activeElement === textAreaEl) {
			return {
				start: textAreaEl.selectionStart ?? value.length,
				end: textAreaEl.selectionEnd ?? value.length
			};
		}
		if (savedSelection) {
			return {
				start: Math.max(0, Math.min(value.length, savedSelection.start)),
				end: Math.max(0, Math.min(value.length, savedSelection.end))
			};
		}
		return { start: value.length, end: value.length };
	}

	function applyFormat(action: InlineFormatAction) {
		const { start, end } = getActiveSelection();
		const next = applyInlineFormatToSelection(value, start, end, action);
		savedSelection = { start: next.selectionStart, end: next.selectionEnd };
		onChange(next.text);
		requestAnimationFrame(() => {
			if (!textAreaEl) return;
			textAreaEl.focus();
			textAreaEl.setSelectionRange(next.selectionStart, next.selectionEnd);
		});
	}

	function insertToken(token: string) {
		const { start, end } = getActiveSelection();
		const before = value.slice(0, start);
		const after = value.slice(end);
		const needsLeadingSpace =
			before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') && !before.endsWith('>');
		const inserted = `${needsLeadingSpace ? ' ' : ''}${token}`;
		const nextText = before + inserted + after;
		const nextCursor = before.length + inserted.length;
		savedSelection = { start: nextCursor, end: nextCursor };
		onChange(nextText);
		requestAnimationFrame(() => {
			if (!textAreaEl) return;
			textAreaEl.focus();
			textAreaEl.setSelectionRange(nextCursor, nextCursor);
		});
	}

	function openFontMenu() {
		captureSelection();
		if (fontMenuOpen) {
			fontMenuOpen = false;
			return;
		}
		if (fontTriggerEl && typeof window !== 'undefined') {
			const rect = fontTriggerEl.getBoundingClientRect();
			const menuW = 248;
			const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 12));
			const top = Math.min(rect.bottom + 4, window.innerHeight - 310);
			fontMenuPos = { top: Math.max(8, Math.round(top)), left: Math.round(left), width: menuW };
		}
		fontSearch = '';
		fontCategory = 'all';
		fontMenuOpen = true;
		requestAnimationFrame(() => fontSearchEl?.focus());
	}

	function chooseInlineFont(family: string) {
		ensureFontLoaded(family);
		fontMenuOpen = false;
		applyFormat({ kind: 'font', value: family });
	}

	function lazyLoadPreview(node: HTMLElement, family: string) {
		if (typeof IntersectionObserver === 'undefined') {
			void ensureFontStylesheet(family);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					void ensureFontStylesheet(family);
					observer.disconnect();
				}
			},
			{ rootMargin: '80px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!fontMenuOpen) return;
		const target = event.target as Node | null;
		if (
			target &&
			(fontMenuRootEl?.contains(target) || fontTriggerEl?.contains(target))
		) {
			return;
		}
		fontMenuOpen = false;
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (fontMenuOpen && event.key === 'Escape') {
			fontMenuOpen = false;
		}
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div class="space-y-1.5">
	<!-- Per-Word Inline Formatting Toolbar -->
	<div
		class="flex flex-wrap items-center gap-1 rounded-lg border border-border-default bg-surface-page p-1"
	>
		<button
			type="button"
			title="Bold selected words (Ctrl+B)"
			aria-label="Bold selected words"
			onmousedown={(e) => {
				e.preventDefault();
				captureSelection();
			}}
			onclick={() => applyFormat({ kind: 'bold' })}
			class="flex h-7 w-7 items-center justify-center rounded border border-transparent text-ink-secondary hover:border-border-default hover:bg-white hover:text-ink-primary"
		>
			<Bold class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			title="Italic selected words (Ctrl+I)"
			aria-label="Italic selected words"
			onmousedown={(e) => {
				e.preventDefault();
				captureSelection();
			}}
			onclick={() => applyFormat({ kind: 'italic' })}
			class="flex h-7 w-7 items-center justify-center rounded border border-transparent text-ink-secondary hover:border-border-default hover:bg-white hover:text-ink-primary"
		>
			<Italic class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			title="Underline selected words (Ctrl+U)"
			aria-label="Underline selected words"
			onmousedown={(e) => {
				e.preventDefault();
				captureSelection();
			}}
			onclick={() => applyFormat({ kind: 'underline' })}
			class="flex h-7 w-7 items-center justify-center rounded border border-transparent text-ink-secondary hover:border-border-default hover:bg-white hover:text-ink-primary"
		>
			<Underline class="h-3.5 w-3.5" />
		</button>

		<div class="mx-0.5 h-4 w-px bg-border-default"></div>

		<div class="flex items-center gap-0.5">
			<input
				type="color"
				aria-label="Selected word colour"
				bind:value={inlineColor}
				onfocus={captureSelection}
				class="h-6 w-6 cursor-pointer rounded border border-border-strong bg-white"
			/>
			<button
				type="button"
				title="Apply colour to selected words"
				aria-label="Apply colour to selected words"
				onmousedown={(e) => {
					e.preventDefault();
					captureSelection();
				}}
				onclick={() => applyFormat({ kind: 'color', value: inlineColor })}
				class="h-7 rounded border border-border-default bg-white px-1.5 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
			>
				Colour
			</button>
		</div>

		<!-- Searchable Live-Preview Inline Font Picker -->
		<button
			bind:this={fontTriggerEl}
			type="button"
			title="Change font of highlighted words"
			aria-label="Change font of highlighted words"
			aria-expanded={fontMenuOpen}
			onmousedown={(e) => {
				e.preventDefault();
				captureSelection();
			}}
			onclick={openFontMenu}
			class="inline-flex h-7 items-center gap-1 rounded border border-border-default bg-white px-1.5 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary {fontMenuOpen
				? 'border-accent text-accent'
				: ''}"
		>
			<Type class="h-3 w-3 shrink-0" />
			<span>Font</span>
			<ChevronDown class="h-3 w-3 shrink-0 opacity-70" />
		</button>

		<!-- Quick Inline Font Size Picker -->
		<select
			aria-label="Change font size of highlighted words"
			value=""
			onmousedown={captureSelection}
			onchange={(e) => {
				const px = Number(e.currentTarget.value);
				if (Number.isFinite(px) && px >= 8) {
					applyFormat({ kind: 'size', value: px });
				}
				e.currentTarget.value = '';
			}}
			class="h-7 rounded border border-border-default bg-white px-1 text-[11px] text-ink-secondary"
		>
			<option value="">Size</option>
			{#each INLINE_SIZE_OPTIONS as px (px)}
				<option value={px}>{px}px</option>
			{/each}
		</select>

		<button
			type="button"
			title="Clear inline formatting"
			aria-label="Clear inline formatting"
			onmousedown={(e) => {
				e.preventDefault();
				captureSelection();
			}}
			onclick={() => applyFormat({ kind: 'clear' })}
			class="ml-auto flex h-7 w-7 items-center justify-center rounded border border-transparent text-ink-muted hover:border-border-default hover:bg-white hover:text-ink-primary"
		>
			<RemoveFormatting class="h-3.5 w-3.5" />
		</button>
	</div>

	<textarea
		bind:this={textAreaEl}
		{id}
		{rows}
		{value}
		{placeholder}
		oninput={(e) => {
			captureSelection();
			onChange(e.currentTarget.value);
		}}
		onselect={captureSelection}
		onmouseup={captureSelection}
		onkeyup={captureSelection}
		onblur={captureSelection}
		onkeydown={(e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
				e.preventDefault();
				captureSelection();
				applyFormat({ kind: 'bold' });
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
				e.preventDefault();
				captureSelection();
				applyFormat({ kind: 'italic' });
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
				e.preventDefault();
				captureSelection();
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
			const start = ta.selectionStart ?? value.length;
			const end = ta.selectionEnd ?? value.length;
			const nextText = value.slice(0, start) + token + value.slice(end);
			savedSelection = { start: start + token.length, end: start + token.length };
			onChange(nextText);
		}}
		class="block w-full resize-y rounded-lg border border-border-strong bg-white px-2.5 py-1.5 text-xs outline-none focus:border-accent"
	></textarea>

	<!-- Quick {{property}} insert chips -->
	<div class="flex flex-wrap gap-1">
		{#each criteria as prop (prop.key)}
			<button
				type="button"
				onmousedown={(e) => {
					e.preventDefault();
					captureSelection();
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

<!-- Fixed Floating Inline Font Picker Popover -->
{#if fontMenuOpen}
	<div
		bind:this={fontMenuRootEl}
		role="dialog"
		aria-label="Choose font for selected text"
		style="top: {fontMenuPos.top}px; left: {fontMenuPos.left}px; width: {fontMenuPos.width}px;"
		class="fixed z-50 overflow-hidden rounded-xl border border-border-strong bg-surface-card shadow-xl"
	>
		<div class="border-b border-border-default p-2">
			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
				/>
				<input
					bind:this={fontSearchEl}
					type="text"
					bind:value={fontSearch}
					placeholder="Search 114 fonts..."
					class="w-full rounded-md border border-border-strong bg-white py-1 pr-6 pl-7 text-xs outline-none focus:border-accent"
				/>
				{#if fontSearch}
					<button
						type="button"
						aria-label="Clear font search"
						onclick={() => (fontSearch = '')}
						class="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
					>
						<X class="h-3 w-3" />
					</button>
				{/if}
			</div>

			<div class="mt-1.5 flex flex-wrap gap-1">
				<button
					type="button"
					onclick={() => (fontCategory = 'all')}
					class="rounded px-1.5 py-0.5 text-[10px] font-medium transition {fontCategory === 'all'
						? 'bg-accent text-white'
						: 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'}"
				>
					All
				</button>
				{#each FONT_CATEGORIES as cat (cat.id)}
					<button
						type="button"
						onclick={() => (fontCategory = cat.id)}
						class="rounded px-1.5 py-0.5 text-[10px] font-medium transition {fontCategory === cat.id
							? 'bg-accent text-white'
							: 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'}"
					>
						{cat.shortLabel}
					</button>
				{/each}
			</div>
		</div>

		<div class="max-h-56 overflow-y-auto p-1">
			{#if filteredFonts.length === 0}
				<p class="py-4 text-center text-xs text-ink-muted">No matching fonts.</p>
			{:else}
				{#each filteredFonts as font (font.family)}
					<button
						type="button"
						use:lazyLoadPreview={font.family}
						onclick={() => chooseInlineFont(font.family)}
						class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
					>
						<span class="truncate" style="font-family: {quoteFontFamily(font.family)}, sans-serif;">
							{font.family}
						</span>
						<span class="shrink-0 text-[10px] text-ink-muted capitalize">{font.category}</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}
