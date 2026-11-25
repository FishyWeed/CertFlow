<script lang="ts">
	import { Check, ChevronDown, Search, X } from '@lucide/svelte';
	import {
		FONT_CATALOG,
		FONT_CATEGORIES,
		type FontCategory
	} from '#lib/config/canvas.ts';
	import { ensureFontLoaded, quoteFontFamily } from './fonts.ts';

	interface Props {
		id?: string;
		value: string;
		compact?: boolean;
		title?: string;
		onSelect: (family: string) => void;
	}

	let { id = 'el-font', value, compact = false, title = 'Choose font family', onSelect }: Props =
		$props();

	let open = $state(false);
	let query = $state('');
	let activeCategory = $state<'all' | FontCategory>('all');
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);
	let menuPos = $state({ top: 0, left: 16, width: 288, maxHeight: 360 });

	const filteredFonts = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return FONT_CATALOG.filter((font) => {
			if (activeCategory !== 'all' && font.category !== activeCategory) return false;
			if (!q) return true;
			return font.family.toLowerCase().includes(q) || font.category.includes(q);
		});
	});

	const categoryShortMap = new Map(FONT_CATEGORIES.map((c) => [c.id, c.shortLabel]));

	function openMenu() {
		if (triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			const width = Math.max(280, Math.round(rect.width));
			const desiredHeight = 380;
			const spaceBelow = window.innerHeight - rect.bottom - 12;
			const spaceAbove = rect.top - 12;
			const openUpward = spaceBelow < 260 && spaceAbove > spaceBelow;
			const maxHeight = Math.max(200, Math.min(desiredHeight, openUpward ? spaceAbove : spaceBelow));
			const top = openUpward
				? Math.max(8, Math.round(rect.top - maxHeight - 6))
				: Math.round(rect.bottom + 6);
			const left = compact
				? Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - width - 8))
				: Math.max(8, Math.min(Math.round(rect.right - width), window.innerWidth - width - 8));
			menuPos = { top, left, width, maxHeight };
		}
		open = true;
		queueMicrotask(() => {
			searchInputEl?.focus();
			searchInputEl?.select();
		});
	}

	function toggleMenu() {
		if (open) {
			open = false;
		} else {
			openMenu();
		}
	}

	function handleChoose(family: string) {
		ensureFontLoaded(family);
		onSelect(family);
		open = false;
		query = '';
	}

	// Lazily load Google Fonts stylesheets for visible font rows so every row renders in its true typeface.
	function observeFontPreview(node: HTMLElement, family: string) {
		if (typeof IntersectionObserver === 'undefined') {
			ensureFontLoaded(family);
			return {};
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						ensureFontLoaded(family);
						observer.disconnect();
						break;
					}
				}
			},
			{ root: listEl, rootMargin: '120px 0px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	$effect(() => {
		if (value) ensureFontLoaded(value);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) open = false;
	}}
/>

<button
	bind:this={triggerEl}
	{id}
	type="button"
	{title}
	aria-haspopup="listbox"
	aria-expanded={open}
	onmousedown={(e) => e.preventDefault()}
	onclick={toggleMenu}
	class={compact
		? 'flex h-8 w-40 shrink-0 items-center justify-between gap-1.5 rounded-lg border border-border-strong bg-white px-2.5 text-left text-xs text-ink-primary transition hover:border-accent/60 focus:border-accent focus:outline-none sm:w-44'
		: 'mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border-strong bg-white px-2.5 py-1.5 text-left text-xs text-ink-primary transition hover:border-accent/60 focus:border-accent focus:outline-none'}
>
	<span
		class="truncate leading-tight {compact ? 'text-xs' : 'text-sm'}"
		style="font-family: {quoteFontFamily(value)};"
	>
		{value}
	</span>
	<ChevronDown class="h-3.5 w-3.5 shrink-0 text-ink-muted" />
</button>

{#if open}
	<div
		role="presentation"
		onclick={() => (open = false)}
		class="fixed inset-0 z-40"
	></div>
	<div
		role="dialog"
		aria-label="Choose font family"
		style="top: {menuPos.top}px; left: {menuPos.left}px; width: {menuPos.width}px; max-height: {menuPos.maxHeight}px;"
		class="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-xl"
	>
		<!-- Search bar -->
		<div class="border-b border-border-default p-2">
			<div class="relative">
				<Search class="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-ink-muted" />
				<input
					bind:this={searchInputEl}
					type="text"
					bind:value={query}
					placeholder={`Search ${FONT_CATALOG.length} fonts...`}
					class="w-full rounded-lg border border-border-strong bg-white py-1.5 pr-7 pl-8 text-xs text-ink-primary outline-none focus:border-accent"
				/>
				{#if query}
					<button
						type="button"
						aria-label="Clear font search"
						onclick={() => (query = '')}
						class="absolute top-1.5 right-1.5 rounded p-0.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>

			<!-- Category filter pills -->
			<div class="mt-2 flex flex-wrap gap-1">
				<button
					type="button"
					onclick={() => (activeCategory = 'all')}
					class="rounded-md px-2 py-0.5 text-[11px] font-medium transition {activeCategory === 'all'
						? 'bg-accent text-white'
						: 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'}"
				>
					All ({FONT_CATALOG.length})
				</button>
				{#each FONT_CATEGORIES as cat (cat.id)}
					<button
						type="button"
						onclick={() => (activeCategory = cat.id)}
						class="rounded-md px-2 py-0.5 text-[11px] font-medium transition {activeCategory === cat.id
							? 'bg-accent text-white'
							: 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'}"
					>
						{cat.shortLabel}
					</button>
				{/each}
			</div>
		</div>

		<!-- Font list -->
		<div bind:this={listEl} role="listbox" class="min-h-0 flex-1 overflow-y-auto p-1">
			{#if filteredFonts.length === 0}
				<p class="px-3 py-6 text-center text-xs text-ink-muted">No matching fonts found.</p>
			{:else}
				{#each filteredFonts as font (font.family)}
					{@const isSelected = font.family.toLowerCase() === value.toLowerCase()}
					<button
						type="button"
						role="option"
						aria-selected={isSelected}
						use:observeFontPreview={font.family}
						onclick={() => handleChoose(font.family)}
						class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition {isSelected
							? 'bg-indigo-50 text-indigo-950'
							: 'text-ink-primary hover:bg-surface-subtle'}"
					>
						<span
							class="min-w-0 truncate text-[15px] leading-snug"
							style="font-family: {quoteFontFamily(font.family)};"
						>
							{font.family}
						</span>
						<span class="flex shrink-0 items-center gap-1.5">
							<span class="text-[10px] font-medium text-ink-muted">
								{categoryShortMap.get(font.category) ?? font.category}
							</span>
							{#if isSelected}
								<Check class="h-3.5 w-3.5 text-accent" />
							{/if}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}
