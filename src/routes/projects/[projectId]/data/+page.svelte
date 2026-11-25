<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Redo2, Save, Undo2, Upload } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import EditableDataTable from '#lib/features/import/EditableDataTable.svelte';
	import {
		applyColumnMapping,
		derivePropertiesFromHeaders,
		parseSpreadsheetFile,
		type ParsedSpreadsheet
	} from '#lib/features/import/parser.ts';
	import { matchTemplateForRow } from '#lib/features/import/routing.ts';
	import { reorderArray } from '#lib/features/import/table-ops.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function makeEmptyRow(cols: string[]): Record<string, string> {
		const row: Record<string, string> = {};
		for (const col of cols) row[col] = '';
		return row;
	}

	function buildInitialState() {
		if (data.project.sourceHeaders.length > 0) {
			const cols = [...data.project.sourceHeaders];
			return {
				fileName: data.project.sourceFileName ?? 'Imported Sheet',
				headers: cols,
				rawRows:
					data.recipients.length > 0
						? data.recipients.map((r) => ({ ...r.rawRow }))
						: [makeEmptyRow(cols)]
			};
		}

		// Default editable table built from the project's property columns.
		const defaultHeaders = data.project.criteriaConfig.map((c) => c.label);
		return {
			fileName: 'Manual Table',
			headers: defaultHeaders,
			rawRows: [makeEmptyRow(defaultHeaders)]
		};
	}

	const initial = untrack(() => buildInitialState());

	let fileName = $state(initial.fileName);
	let headers = $state<string[]>(initial.headers);
	let rawRows = $state<Record<string, string>[]>(initial.rawRows);
	let saving = $state(false);
	let feedback = $state('');
	let fileInputEl = $state<HTMLInputElement | null>(null);

	// Holds an uploaded spreadsheet until the user confirms replacing existing table rows.
	let pendingImport = $state<ParsedSpreadsheet | null>(null);
	let showReplaceConfirm = $state(false);

	// Table Undo / Redo history so Ctrl+Z / Ctrl+Y work anywhere on the Data & Property Table page.
	interface TableSnapshot {
		headers: string[];
		rawRows: Record<string, string>[];
	}
	let pastSnapshots = $state<TableSnapshot[]>([]);
	let futureSnapshots = $state<TableSnapshot[]>([]);

	function snapshotTable(): TableSnapshot {
		return {
			headers: [...$state.snapshot(headers)],
			rawRows: structuredClone($state.snapshot(rawRows))
		};
	}

	function pushTableHistory() {
		pastSnapshots = [...pastSnapshots.slice(-39), snapshotTable()];
		futureSnapshots = [];
	}

	function undoTable() {
		const prev = pastSnapshots.at(-1);
		if (!prev) return;
		futureSnapshots = [snapshotTable(), ...futureSnapshots];
		pastSnapshots = pastSnapshots.slice(0, -1);
		headers = prev.headers;
		rawRows = prev.rawRows;
	}

	function redoTable() {
		const next = futureSnapshots[0];
		if (!next) return;
		pastSnapshots = [...pastSnapshots, snapshotTable()];
		futureSnapshots = futureSnapshots.slice(1);
		headers = next.headers;
		rawRows = next.rawRows;
	}

	function handleDataKeydown(event: KeyboardEvent) {
		const mod = event.ctrlKey || event.metaKey;
		if (!mod) return;
		const key = event.key.toLowerCase();
		if (key === 'z') {
			if (event.shiftKey) {
				if (futureSnapshots.length > 0) {
					event.preventDefault();
					redoTable();
				}
			} else if (pastSnapshots.length > 0) {
				event.preventDefault();
				undoTable();
			}
		} else if (key === 'y' && futureSnapshots.length > 0) {
			event.preventDefault();
			redoTable();
		} else if (key === 's') {
			event.preventDefault();
			if (!saving) void handleSaveDataset();
		}
	}

	function rowHasData(row: Record<string, string>): boolean {
		return Object.values(row).some((val) => val.trim() !== '');
	}

	const derivedSchema = $derived(derivePropertiesFromHeaders(headers));

	const headerKeys = $derived.by(() => {
		const lookup: Record<string, string> = {};
		for (const [key, header] of Object.entries(derivedSchema.mapping)) {
			lookup[header] = key;
		}
		return lookup;
	});

	const nonEmptyRows = $derived(rawRows.filter(rowHasData));

	const matchedTemplates = $derived(
		rawRows.map((row) => {
			const mapped = applyColumnMapping(
				row,
				derivedSchema.mapping,
				derivedSchema.properties,
				data.project.defaultCertTitle
			);
			const matched = matchTemplateForRow(
				data.templates,
				mapped.role ?? 'Participant',
				mapped.rank ?? mapped.ranking ?? '',
				mapped
			);
			return matched?.name ?? 'Unassigned';
		})
	);

	function applyImportedSpreadsheet(parsed: ParsedSpreadsheet) {
		pushTableHistory();
		fileName = parsed.fileName;
		headers =
			parsed.headers.length > 0
				? parsed.headers
				: data.project.criteriaConfig.map((c) => c.label);
		rawRows = parsed.rows.length > 0 ? parsed.rows : [makeEmptyRow(headers)];
		feedback = `Loaded ${parsed.rows.length} rows from "${parsed.fileName}". Review column headers and click Save Dataset.`;
	}

	async function handleFileSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		feedback = '';
		const parsed = await parseSpreadsheetFile(file);
		input.value = '';

		if (nonEmptyRows.length > 0) {
			pendingImport = parsed;
			showReplaceConfirm = true;
			return;
		}

		applyImportedSpreadsheet(parsed);
	}

	function confirmReplaceImport() {
		if (pendingImport) {
			applyImportedSpreadsheet(pendingImport);
		}
		pendingImport = null;
		showReplaceConfirm = false;
	}

	function cancelReplaceImport() {
		pendingImport = null;
		showReplaceConfirm = false;
	}

	function handleUpdateCell(rowIndex: number, header: string, value: string) {
		pushTableHistory();
		rawRows = rawRows.map((row, idx) => (idx === rowIndex ? { ...row, [header]: value } : row));
	}

	function handleAddRow() {
		pushTableHistory();
		rawRows = [...rawRows, makeEmptyRow(headers)];
	}

	function handleDeleteRow(rowIndex: number) {
		pushTableHistory();
		const next = rawRows.filter((_, i) => i !== rowIndex);
		rawRows = next.length > 0 ? next : [makeEmptyRow(headers)];
	}

	function handleReorderRow(fromIndex: number, toIndex: number) {
		pushTableHistory();
		rawRows = reorderArray(rawRows, fromIndex, toIndex);
	}

	function handleAddColumn(columnName: string) {
		if (headers.includes(columnName)) {
			feedback = `Column "${columnName}" already exists.`;
			return;
		}
		pushTableHistory();
		headers = [...headers, columnName];
		rawRows = rawRows.map((row) => ({ ...row, [columnName]: '' }));
		feedback = `Added column "${columnName}".`;
	}

	function handleReorderColumn(fromIndex: number, toIndex: number) {
		pushTableHistory();
		headers = reorderArray(headers, fromIndex, toIndex);
	}

	function handleRenameColumn(oldName: string, rawNewName: string) {
		const nextName = rawNewName.trim();
		if (!nextName || nextName === oldName) return;
		if (headers.includes(nextName)) {
			feedback = `Column "${nextName}" already exists.`;
			return;
		}

		pushTableHistory();
		headers = headers.map((h) => (h === oldName ? nextName : h));
		rawRows = rawRows.map((row) => {
			const nextRow: Record<string, string> = {};
			for (const [k, v] of Object.entries(row)) {
				nextRow[k === oldName ? nextName : k] = v;
			}
			return nextRow;
		});
	}

	function handleDeleteColumn(columnName: string) {
		if (headers.length <= 1) return;
		pushTableHistory();
		headers = headers.filter((h) => h !== columnName);
		rawRows = rawRows.map((row) => {
			const nextRow = { ...row };
			delete nextRow[columnName];
			return nextRow;
		});
	}

	async function handleSaveDataset() {
		saving = true;
		feedback = '';
		try {
			const res = await fetch(`/api/projects/${data.project.id}/recipients`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					fileName,
					headers,
					columnMapping: derivedSchema.mapping,
					rows: nonEmptyRows
				})
			});
			if (!res.ok) throw new Error('Failed to save dataset.');
			const body = await res.json();
			await invalidateAll();
			feedback = `Saved ${body.importedCount} rows and ${headers.length} properties. Ready to generate certificates.`;
		} catch (err) {
			feedback = err instanceof Error ? err.message : 'Save failed.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={handleDataKeydown} />

<main class="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 px-3 py-5 sm:px-6 sm:py-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h2 class="text-base font-bold text-ink-primary sm:text-lg">Data & Property Table</h2>
			<p class="mt-0.5 text-xs text-ink-secondary sm:text-sm">
				Each column header is a property. Edit cells, add or rename columns or import a CSV or Excel
				file.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<Button
				size="sm"
				variant="ghost"
				aria-label="Undo table change"
				disabled={pastSnapshots.length === 0}
				onclick={undoTable}
			>
				<Undo2 class="h-4 w-4" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				aria-label="Redo table change"
				disabled={futureSnapshots.length === 0}
				onclick={redoTable}
			>
				<Redo2 class="h-4 w-4" />
			</Button>
			<input
				bind:this={fileInputEl}
				type="file"
				accept=".csv,.xlsx,.xls"
				onchange={handleFileSelect}
				class="hidden"
			/>
			<Button size="sm" onclick={() => fileInputEl?.click()}>
				<Upload class="h-4 w-4" />
				Import CSV / Excel
			</Button>
			<Button size="sm" variant="primary" disabled={saving} onclick={handleSaveDataset}>
				<Save class="h-4 w-4" />
				{saving ? 'Saving...' : `Save Dataset (${nonEmptyRows.length})`}
			</Button>
		</div>
	</div>

	{#if feedback}
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 sm:text-sm">
			{feedback}
		</div>
	{/if}

	<EditableDataTable
		{fileName}
		{headers}
		{headerKeys}
		rows={rawRows}
		{matchedTemplates}
		onUpdateCell={handleUpdateCell}
		onAddRow={handleAddRow}
		onDeleteRow={handleDeleteRow}
		onReorderRow={handleReorderRow}
		onAddColumn={handleAddColumn}
		onRenameColumn={handleRenameColumn}
		onDeleteColumn={handleDeleteColumn}
		onReorderColumn={handleReorderColumn}
	/>
</main>

<!-- Confirmation popup before replacing existing table data with an uploaded CSV/Excel file -->
<Modal
	bind:open={showReplaceConfirm}
	title="Replace Existing Table Data?"
	description="If you import this file, it replaces the current rows and columns in your table."
>
	{#if pendingImport}
		<div class="space-y-4">
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
				<p>
					<strong>Incoming file:</strong>
					{pendingImport.fileName} ({pendingImport.rows.length} rows, {pendingImport.headers.length}
					columns)
				</p>
				<p class="mt-1">
					<strong>Existing rows to replace:</strong>
					{nonEmptyRows.length}
					{nonEmptyRows.length === 1 ? 'row' : 'rows'} currently in the table.
				</p>
			</div>

			<div class="flex justify-end gap-2">
				<Button onclick={cancelReplaceImport}>Cancel</Button>
				<Button variant="danger" onclick={confirmReplaceImport}>Replace Data</Button>
			</div>
		</div>
	{/if}
</Modal>
