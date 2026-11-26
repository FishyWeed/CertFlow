<script lang="ts">
	import {
		ArrowDownZA,
		ArrowUpAZ,
		ChevronDown,
		Filter,
		GripVertical,
		Plus,
		Search,
		Trash2,
		X
	} from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import {
		EMPTY_CATEGORY,
		TEMPLATE_COLUMN_KEY,
		filterAndSortRows,
		getColumnCategories,
		type TableSort
	} from './table-ops.ts';

	interface Props {
		fileName: string;
		headers: string[];
		headerKeys: Record<string, string>;
		rows: Record<string, string>[];
		matchedTemplates: string[];
		onUpdateCell: (rowIndex: number, header: string, value: string) => void;
		onAddRow: () => void;
		onDeleteRow: (rowIndex: number) => void;
		onReorderRow: (fromIndex: number, toIndex: number) => void;
		onAddColumn: (columnName: string) => void;
		onRenameColumn: (oldName: string, newName: string) => void;
		onDeleteColumn: (columnName: string) => void;
		onReorderColumn: (fromIndex: number, toIndex: number) => void;
	}

	let {
		fileName,
		headers,
		headerKeys,
		rows,
		matchedTemplates,
		onUpdateCell,
		onAddRow,
		onDeleteRow,
		onReorderRow,
		onAddColumn,
		onRenameColumn,
		onDeleteColumn,
		onReorderColumn
	}: Props = $props();

	let newColumnName = $state('');
	let searchQuery = $state('');
	let categoryFilters = $state<Record<string, string[]>>({});
	let sort = $state<TableSort | null>(null);

	// Header category filter popover state (fixed positioning prevents clipping in overflow-x-auto).
	let openFilterCol = $state<string | null>(null);
	let popoverPos = $state({ top: 0, left: 16 });
	let categorySearch = $state('');

	// Drag-and-drop state for rows and columns.
	let draggingRowIndex = $state<number | null>(null);
	let dragOverRowIndex = $state<number | null>(null);
	let draggingColIndex = $state<number | null>(null);
	let dragOverColIndex = $state<number | null>(null);

	const visibleRows = $derived(
		filterAndSortRows(rows, matchedTemplates, {
			search: searchQuery,
			categoryFilters,
			sort
		})
	);

	const activeFilterEntries = $derived(
		Object.entries(categoryFilters).filter(([, vals]) => vals.length > 0)
	);

	const hasActiveViewControls = $derived(
		Boolean(searchQuery.trim()) || activeFilterEntries.length > 0 || sort !== null
	);

	const tplActiveCount = $derived((categoryFilters[TEMPLATE_COLUMN_KEY] ?? []).length);
	const tplSorted = $derived(sort?.column === TEMPLATE_COLUMN_KEY);

	const openFilterCategories = $derived.by(() => {
		if (!openFilterCol) return [];
		const all = getColumnCategories(rows, matchedTemplates, openFilterCol);
		const q = categorySearch.trim().toLowerCase();
		if (!q) return all;
		return all.filter((opt) => opt.label.toLowerCase().includes(q));
	});

	function getColumnLabel(colKey: string): string {
		return colKey === TEMPLATE_COLUMN_KEY ? 'Matched Template' : colKey;
	}

	function openHeaderPopover(colKey: string, triggerEl: HTMLElement) {
		if (openFilterCol === colKey) {
			openFilterCol = null;
			return;
		}
		const rect = triggerEl.getBoundingClientRect();
		const popoverWidth = 256;
		const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 12));
		const top = Math.min(rect.bottom + 6, window.innerHeight - 320);
		popoverPos = { top: Math.round(Math.max(8, top)), left: Math.round(left) };
		categorySearch = '';
		openFilterCol = colKey;
	}

	function toggleCategoryValue(colKey: string, categoryKey: string) {
		const current = categoryFilters[colKey] ?? [];
		const exists = current.includes(categoryKey);
		const next = exists ? current.filter((k) => k !== categoryKey) : [...current, categoryKey];
		if (next.length === 0) {
			const copy = { ...categoryFilters };
			delete copy[colKey];
			categoryFilters = copy;
		} else {
			categoryFilters = { ...categoryFilters, [colKey]: next };
		}
	}

	function clearColumnFilter(colKey: string) {
		const copy = { ...categoryFilters };
		delete copy[colKey];
		categoryFilters = copy;
	}

	function clearAllViewControls() {
		searchQuery = '';
		categoryFilters = {};
		sort = null;
		openFilterCol = null;
	}

	function toggleSort(colKey: string, direction: 'asc' | 'desc') {
		if (sort?.column === colKey && sort.direction === direction) {
			sort = null;
		} else {
			sort = { column: colKey, direction };
		}
	}

	function formatCategoryChipLabel(colKey: string, selectedKeys: string[]): string {
		const cats = getColumnCategories(rows, matchedTemplates, colKey);
		const lookup = new Map(cats.map((c) => [c.key, c.label]));
		const labels = selectedKeys.map((k) =>
			k === EMPTY_CATEGORY ? '(Empty)' : (lookup.get(k) ?? k)
		);
		if (labels.length <= 2) return labels.join(', ');
		return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
	}

	function handleRenameHeader(oldName: string, rawNewName: string) {
		const nextName = rawNewName.trim();
		if (!nextName || nextName === oldName) return;
		if (categoryFilters[oldName]) {
			const copy = { ...categoryFilters };
			copy[nextName] = copy[oldName];
			delete copy[oldName];
			categoryFilters = copy;
		}
		if (sort?.column === oldName) {
			sort = { ...sort, column: nextName };
		}
		if (openFilterCol === oldName) {
			openFilterCol = nextName;
		}
		onRenameColumn(oldName, nextName);
	}

	function handleDeleteHeader(colName: string) {
		if (categoryFilters[colName]) clearColumnFilter(colName);
		if (sort?.column === colName) sort = null;
		if (openFilterCol === colName) openFilterCol = null;
		onDeleteColumn(colName);
	}

	function handleAddColumnSubmit(event: SubmitEvent) {
		event.preventDefault();
		const cleaned = newColumnName.trim();
		if (!cleaned) return;
		onAddColumn(cleaned);
		newColumnName = '';
	}

	function handleAddRowClick() {
		if (searchQuery.trim() || activeFilterEntries.length > 0) {
			searchQuery = '';
			categoryFilters = {};
		}
		onAddRow();
	}

	// Row drag handlers
	function handleRowDragStart(event: DragEvent, originalIndex: number) {
		if (sort !== null) {
			event.preventDefault();
			return;
		}
		draggingRowIndex = originalIndex;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('application/x-certflow-table-row', String(originalIndex));
		}
	}

	function handleRowDragOver(event: DragEvent, targetOriginalIndex: number) {
		if (draggingRowIndex === null || draggingRowIndex === targetOriginalIndex) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		dragOverRowIndex = targetOriginalIndex;
	}

	function handleRowDrop(event: DragEvent, targetOriginalIndex: number) {
		if (draggingRowIndex === null) return;
		event.preventDefault();
		if (draggingRowIndex !== targetOriginalIndex) {
			onReorderRow(draggingRowIndex, targetOriginalIndex);
		}
		draggingRowIndex = null;
		dragOverRowIndex = null;
	}

	function handleRowDragEnd() {
		draggingRowIndex = null;
		dragOverRowIndex = null;
	}

	// Column drag handlers
	function handleColDragStart(event: DragEvent, colIdx: number) {
		draggingColIndex = colIdx;
		openFilterCol = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('application/x-certflow-table-col', String(colIdx));
		}
	}

	function handleColDragOver(event: DragEvent, targetColIdx: number) {
		if (draggingColIndex === null || draggingColIndex === targetColIdx) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		dragOverColIndex = targetColIdx;
	}

	function handleColDrop(event: DragEvent, targetColIdx: number) {
		if (draggingColIndex === null) return;
		event.preventDefault();
		if (draggingColIndex !== targetColIdx) {
			onReorderColumn(draggingColIndex, targetColIdx);
		}
		draggingColIndex = null;
		dragOverColIndex = null;
	}

	function handleColDragEnd() {
		draggingColIndex = null;
		dragOverColIndex = null;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && openFilterCol) openFilterCol = null;
	}}
/>

<section class="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-xs">
	<!-- Compact Spreadsheet Toolbar -->
	<div
		class="flex flex-col gap-2.5 border-b border-border-default bg-surface-subtle/70 px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex min-w-0 flex-wrap items-center gap-2.5">
			<h3 class="font-display truncate text-sm font-semibold text-ink-primary">
				{fileName || 'Data Table'}
				<span class="font-sans font-normal text-ink-secondary tabular-nums">
					{#if visibleRows.length !== rows.length}
						(Showing {visibleRows.length} of {rows.length} rows, {headers.length} columns)
					{:else}
						({rows.length} {rows.length === 1 ? 'row' : 'rows'}, {headers.length} columns)
					{/if}
				</span>
			</h3>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<!-- Live Table Search -->
			<div class="relative min-w-44 flex-1 sm:w-56 sm:flex-initial">
				<Search
					class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
				/>
				<input
					type="text"
					aria-label="Search table rows"
					bind:value={searchQuery}
					placeholder="Search rows..."
					class="h-[30px] w-full rounded-md border border-border-strong bg-surface-card py-1 pr-7 pl-8 text-xs text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid dark:bg-surface-recessed"
				/>
				{#if searchQuery}
					<button
						type="button"
						aria-label="Clear search"
						onclick={() => (searchQuery = '')}
						class="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
					>
						<X class="h-3 w-3" />
					</button>
				{/if}
			</div>

			<form class="flex items-center gap-1.5" onsubmit={handleAddColumnSubmit}>
				<input
					type="text"
					aria-label="New column name"
					bind:value={newColumnName}
					placeholder="Add column..."
					class="h-[30px] w-32 rounded-md border border-border-strong bg-surface-card px-2.5 py-1 text-xs text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid dark:bg-surface-recessed sm:w-36"
				/>
				<Button type="submit" size="sm" disabled={!newColumnName.trim()}>
					<Plus class="h-3.5 w-3.5" />
					Column
				</Button>
			</form>

			<Button size="sm" variant="secondary" onclick={handleAddRowClick}>
				<Plus class="h-3.5 w-3.5" />
				Add Row
			</Button>
		</div>
	</div>

	<!-- Active Filters / Sort Bar -->
	{#if hasActiveViewControls}
		<div
			class="flex flex-wrap items-center gap-1.5 border-b border-border-default bg-tone-editor-soft/50 px-3 py-2 text-xs sm:px-4"
		>
			<span class="font-medium text-ink-secondary">Active view:</span>

			{#if searchQuery.trim()}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-tone-editor-border bg-surface-card px-2.5 py-0.5 text-xs font-medium text-tone-editor-ink"
				>
					Search: "{searchQuery.trim()}"
					<button
						type="button"
						aria-label="Clear search filter"
						onclick={() => (searchQuery = '')}
						class="cursor-pointer rounded-full hover:opacity-75"
					>
						<X class="h-3 w-3" />
					</button>
				</span>
			{/if}

			{#each activeFilterEntries as [colKey, selectedKeys] (colKey)}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-tone-editor-border bg-surface-card px-2.5 py-0.5 text-xs font-medium text-tone-editor-ink"
				>
					{getColumnLabel(colKey)}: {formatCategoryChipLabel(colKey, selectedKeys)}
					<button
						type="button"
						aria-label="Clear filter on {getColumnLabel(colKey)}"
						onclick={() => clearColumnFilter(colKey)}
						class="cursor-pointer rounded-full hover:opacity-75"
					>
						<X class="h-3 w-3" />
					</button>
				</span>
			{/each}

			{#if sort}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-tone-certs-border bg-tone-certs-soft px-2.5 py-0.5 text-xs font-medium text-tone-certs-ink"
				>
					Sorted: {getColumnLabel(sort.column)} ({sort.direction === 'asc' ? 'A–Z' : 'Z–A'})
					<button
						type="button"
						aria-label="Clear sort"
						onclick={() => (sort = null)}
						class="cursor-pointer rounded-full hover:opacity-75"
					>
						<X class="h-3 w-3" />
					</button>
				</span>
			{/if}

			<button
				type="button"
				onclick={clearAllViewControls}
				class="ml-auto cursor-pointer text-xs font-semibold text-accent-ink hover:underline"
			>
				Clear All
			</button>
		</div>
	{/if}

	<!-- Spreadsheet Grid -->
	<div class="w-full overflow-x-auto">
		<table class="w-full border-collapse text-left text-xs">
			<thead>
				<tr class="border-b border-border-default bg-surface-subtle">
					<th
						class="sticky left-0 z-10 w-14 border-r border-border-default bg-surface-subtle px-2 py-2 text-center font-semibold text-ink-secondary"
					>
						#
					</th>
					{#each headers as header, colIdx (header)}
						{@const propKey = headerKeys[header] ?? ''}
						{@const activeCount = (categoryFilters[header] ?? []).length}
						{@const isSorted = sort?.column === header}
						<th
							ondragover={(e) => handleColDragOver(e, colIdx)}
							ondrop={(e) => handleColDrop(e, colIdx)}
							class="min-w-[160px] border-r border-border-default p-1.5 align-top transition xl:min-w-0 {dragOverColIndex ===
							colIdx
								? 'bg-tone-editor-soft ring-2 ring-tone-editor ring-inset'
								: ''}"
						>
							<div class="flex items-center gap-1">
								<span
									role="button"
									tabindex="0"
									draggable="true"
									title="Drag to rearrange column"
									aria-label="Drag to rearrange column {header}"
									ondragstart={(e) => handleColDragStart(e, colIdx)}
									ondragend={handleColDragEnd}
									class="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-muted hover:bg-surface-card hover:text-ink-primary active:cursor-grabbing"
								>
									<GripVertical class="h-3.5 w-3.5" />
								</span>
								<input
									type="text"
									aria-label="Column {colIdx + 1} property name"
									value={header}
									onchange={(e) => handleRenameHeader(header, e.currentTarget.value)}
									class="min-h-7 w-full min-w-0 rounded border border-border-default bg-surface-card px-2 py-1 text-xs font-semibold text-ink-primary outline-none focus:border-tone-editor dark:bg-surface-recessed"
								/>
								{#if headers.length > 1}
									<button
										type="button"
										title="Remove column"
										aria-label="Remove column {header}"
										onclick={() => handleDeleteHeader(header)}
										class="flex h-7 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-ink-muted hover:bg-tone-danger-soft hover:text-tone-danger-ink"
									>
										<X class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>

							<!-- Clickable Header Bar: opens category filter & sort popover -->
							<button
								type="button"
								aria-haspopup="dialog"
								aria-expanded={openFilterCol === header}
								aria-label="Filter or sort {header}"
								onclick={(e) => openHeaderPopover(header, e.currentTarget)}
								class="mt-1 flex w-full cursor-pointer items-center justify-between gap-1.5 rounded px-1.5 py-1 text-left transition {activeCount >
									0 || isSorted
									? 'bg-tone-editor-soft text-tone-editor-ink'
									: 'text-ink-muted hover:bg-surface-card hover:text-ink-primary'}"
							>
								<span class="flex min-w-0 items-center gap-1 truncate">
									{#if propKey}
										<code
											class="rounded border border-tone-editor-border bg-tone-editor-soft px-1 py-0.5 font-mono text-[10.5px] font-medium text-tone-editor-ink"
										>
											{`{{${propKey}}}`}
										</code>
									{/if}
								</span>

								<span class="flex shrink-0 items-center gap-1 text-[11px] font-medium">
									{#if isSorted}
										{#if sort?.direction === 'asc'}
											<ArrowUpAZ class="h-3 w-3 text-tone-certs-ink" />
										{:else}
											<ArrowDownZA class="h-3 w-3 text-tone-certs-ink" />
										{/if}
									{/if}
									{#if activeCount > 0}
										<span class="rounded-full bg-tone-editor px-1.5 font-mono text-[10px] font-semibold text-white tabular-nums">
											{activeCount}
										</span>
									{:else}
										<Filter class="h-3 w-3 opacity-70" />
									{/if}
									<ChevronDown class="h-3 w-3 opacity-70" />
								</span>
							</button>
						</th>
					{/each}

					<!-- Clickable Matched Template Header for Category Filter & Sort -->
					<th class="w-44 border-r border-border-default p-1.5 align-top whitespace-nowrap">
						<button
							type="button"
							aria-haspopup="dialog"
							aria-expanded={openFilterCol === TEMPLATE_COLUMN_KEY}
							aria-label="Filter or sort Matched Template"
							onclick={(e) => openHeaderPopover(TEMPLATE_COLUMN_KEY, e.currentTarget)}
							class="flex w-full cursor-pointer flex-col rounded px-2 py-1 text-left transition {tplActiveCount >
								0 || tplSorted
								? 'bg-tone-editor-soft text-tone-editor-ink'
								: 'hover:bg-surface-card'}"
						>
							<span class="flex items-center justify-between gap-2 font-semibold text-ink-secondary">
								<span>Matched Template</span>
								<span class="flex items-center gap-1">
									{#if tplSorted}
										{#if sort?.direction === 'asc'}
											<ArrowUpAZ class="h-3 w-3 text-tone-certs-ink" />
										{:else}
											<ArrowDownZA class="h-3 w-3 text-tone-certs-ink" />
										{/if}
									{/if}
									{#if tplActiveCount > 0}
										<span class="rounded-full bg-tone-editor px-1.5 font-mono text-[10px] font-semibold text-white tabular-nums">
											{tplActiveCount}
										</span>
									{:else}
										<Filter class="h-3 w-3 text-ink-muted" />
									{/if}
								</span>
							</span>
							<span class="mt-0.5 text-[11px] font-normal text-ink-muted">Click to filter</span>
						</button>
					</th>
					<th class="w-11 px-2 py-2 text-center align-top font-semibold text-ink-secondary">Del</th>
				</tr>
			</thead>

			<tbody class="divide-y divide-border-subtle bg-surface-card">
				{#if visibleRows.length === 0}
					<tr>
						<td
							colspan={headers.length + 3}
							class="px-4 py-8 text-center text-xs text-ink-muted"
						>
							No rows match your current search or category filters.
							<button
								type="button"
								onclick={clearAllViewControls}
								class="ml-1.5 cursor-pointer font-semibold text-accent-ink hover:underline"
							>
								Clear filters
							</button>
						</td>
					</tr>
				{:else}
					{#each visibleRows as item, displayIdx (item.originalIndex)}
						<tr
							ondragover={(e) => handleRowDragOver(e, item.originalIndex)}
							ondrop={(e) => handleRowDrop(e, item.originalIndex)}
							class="group transition hover:bg-surface-subtle/45 {dragOverRowIndex ===
							item.originalIndex
								? 'bg-tone-editor-soft outline-2 -outline-offset-2 outline-tone-editor'
								: ''}"
						>
							<td
								class="sticky left-0 z-10 border-r border-border-default bg-surface-page px-1.5 py-2 font-mono text-ink-secondary tabular-nums"
							>
								<div class="flex items-center justify-center gap-1">
									<span
										role="button"
										tabindex="0"
										draggable={sort === null}
										title={sort === null
											? 'Drag to rearrange row'
											: 'Clear sort to rearrange rows'}
										aria-label="Drag to rearrange row {displayIdx + 1}"
										ondragstart={(e) => handleRowDragStart(e, item.originalIndex)}
										ondragend={handleRowDragEnd}
										class="flex h-6 w-4 items-center justify-center rounded text-ink-muted {sort ===
										null
											? 'cursor-grab hover:bg-surface-card hover:text-ink-primary active:cursor-grabbing'
											: 'cursor-not-allowed opacity-35'}"
									>
										<GripVertical class="h-3.5 w-3.5" />
									</span>
									<span class="min-w-4 text-center">{item.originalIndex + 1}</span>
								</div>
							</td>

							{#each headers as header (header)}
								<td class="border-r border-border-subtle p-1">
									<input
										type="text"
										aria-label="Row {item.originalIndex + 1} {header}"
										value={item.row[header] ?? ''}
										oninput={(e) =>
											onUpdateCell(item.originalIndex, header, e.currentTarget.value)}
										placeholder="Type here..."
										class="min-h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-1 text-xs text-ink-primary placeholder:text-ink-muted/60 outline-none transition hover:border-border-default focus:border-tone-editor focus:bg-surface-card focus:ring-2 focus:ring-tone-editor/20 dark:focus:bg-surface-recessed"
									/>
								</td>
							{/each}

							<td class="border-r border-border-subtle px-2.5 py-2 whitespace-nowrap">
								<Badge tone={item.matchedTemplate === 'Unassigned' ? 'danger' : 'indigo'} dot>
									{item.matchedTemplate}
								</Badge>
							</td>

							<td class="px-1.5 py-1.5 text-center">
								<button
									type="button"
									aria-label="Delete row {item.originalIndex + 1}"
									title="Delete row"
									onclick={() => onDeleteRow(item.originalIndex)}
									class="cf-pressable inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tone-danger-ink hover:bg-tone-danger-soft"
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Bottom Add Row Bar -->
	<div
		class="flex flex-wrap items-center justify-between gap-2 border-t border-border-default bg-surface-page px-3 py-2.5 sm:px-4"
	>
		<Button size="sm" variant="secondary" onclick={handleAddRowClick}>
			<Plus class="h-3.5 w-3.5" />
			Add Row
		</Button>
		<p class="text-[11px] text-ink-muted">
			Drag handles to rearrange rows or columns. Click any column header to filter by category.
		</p>
	</div>
</section>

<!-- Fixed Floating Column Category Filter & Sort Popover -->
{#if openFilterCol}
	{@const colKey = openFilterCol}
	{@const selectedKeys = categoryFilters[colKey] ?? []}
	<div
		role="presentation"
		onclick={() => (openFilterCol = null)}
		class="fixed inset-0 z-40"
	></div>
	<div
		role="dialog"
		aria-label="Filter and sort {getColumnLabel(colKey)}"
		style="top: {popoverPos.top}px; left: {popoverPos.left}px;"
		class="cf-popover-in fixed z-50 w-64 rounded-xl border border-border-default bg-surface-elevated p-3 shadow-md"
	>
		<div class="flex items-center justify-between border-b border-border-subtle pb-2">
			<p class="truncate text-xs font-semibold text-ink-primary">{getColumnLabel(colKey)}</p>
			<button
				type="button"
				aria-label="Close filter menu"
				onclick={() => (openFilterCol = null)}
				class="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>

		<!-- Sort Buttons -->
		<div class="mt-2.5 grid grid-cols-2 gap-1.5">
			<button
				type="button"
				onclick={() => toggleSort(colKey, 'asc')}
				class="cf-pressable flex cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium {sort?.column ===
					colKey && sort.direction === 'asc'
					? 'border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink'
					: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
			>
				<ArrowUpAZ class="h-3.5 w-3.5" />
				Sort A–Z
			</button>
			<button
				type="button"
				onclick={() => toggleSort(colKey, 'desc')}
				class="cf-pressable flex cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium {sort?.column ===
					colKey && sort.direction === 'desc'
					? 'border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink'
					: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
			>
				<ArrowDownZA class="h-3.5 w-3.5" />
				Sort Z–A
			</button>
		</div>

		<!-- Category Checklist -->
		<div class="mt-3 border-t border-border-subtle pt-2.5">
			<div class="flex items-center justify-between text-[11px]">
				<span class="font-semibold tracking-[0.07em] text-ink-muted uppercase">
					Filter by Category
				</span>
				{#if selectedKeys.length > 0}
					<button
						type="button"
						onclick={() => clearColumnFilter(colKey)}
						class="cursor-pointer font-medium text-accent-ink hover:underline"
					>
						Show All
					</button>
				{/if}
			</div>

			{#if getColumnCategories(rows, matchedTemplates, colKey).length > 6}
				<input
					type="text"
					aria-label="Search categories"
					bind:value={categorySearch}
					placeholder="Filter categories..."
					class="mt-1.5 h-[30px] w-full rounded-md border border-border-strong bg-surface-card px-2 py-1 text-xs text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid dark:bg-surface-recessed"
				/>
			{/if}

			<div class="mt-2 max-h-48 space-y-1 overflow-y-auto pr-0.5">
				{#each openFilterCategories as opt (opt.key)}
					{@const checked = selectedKeys.includes(opt.key)}
					<label
						class="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition hover:bg-surface-subtle"
					>
						<span class="flex min-w-0 items-center gap-2">
							<input
								type="checkbox"
								{checked}
								onchange={() => toggleCategoryValue(colKey, opt.key)}
								class="h-3.5 w-3.5 shrink-0 rounded-[4px] border-border-strong accent-accent"
							/>
							<span class="truncate {opt.key === EMPTY_CATEGORY ? 'text-ink-muted italic' : 'text-ink-primary'}">
								{opt.label}
							</span>
						</span>
						<span class="shrink-0 rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
							{opt.count}
						</span>
					</label>
				{/each}
				{#if openFilterCategories.length === 0}
					<p class="py-2 text-center text-[11px] text-ink-muted">No matching categories.</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
