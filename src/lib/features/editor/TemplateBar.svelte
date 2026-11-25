<script lang="ts">
	import {
		ArrowRight,
		Eye,
		Maximize2,
		Pencil,
		Redo2,
		Save,
		Trash2,
		Undo2,
		X,
		ZoomIn,
		ZoomOut
	} from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import type {
		CriterionDefinition,
		TemplateCanvasState,
		TemplateRankingRule
	} from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';

	export interface TemplateRecord {
		id: string;
		name: string;
		assignedRoles: string[];
		rankingRule: TemplateRankingRule;
		isDefault: boolean;
		width: number;
		height: number;
		canvasState: TemplateCanvasState;
	}

	interface Props {
		templates: TemplateRecord[];
		properties: CriterionDefinition[];
		propertyValueOptions: Record<string, string[]>;
		activeTemplateId: string;
		editor: EditorState;
		saving: boolean;
		onSelectTemplate: (templateId: string) => void;
		onSaveTemplate: () => void;
		onCreateTemplate: (payload: {
			name: string;
			assignedRoles: string[];
			rankingRule: TemplateRankingRule;
		}) => Promise<void>;
		onUpdateTemplateRules: (payload: {
			name: string;
			assignedRoles: string[];
			rankingRule: TemplateRankingRule;
		}) => Promise<void>;
		onDeleteTemplate: () => Promise<void>;
		onGenerateCertificates: () => Promise<void>;
	}

	let {
		templates,
		properties,
		propertyValueOptions,
		activeTemplateId,
		editor,
		saving,
		onSelectTemplate,
		onSaveTemplate,
		onCreateTemplate,
		onUpdateTemplateRules,
		onDeleteTemplate,
		onGenerateCertificates
	}: Props = $props();

	const ADD_NEW_VALUE = '__add_new_template__';

	let showNewModal = $state(false);
	let showEditModal = $state(false);
	let confirmingDelete = $state(false);
	let deletingTemplate = $state(false);
	let goingToGenerate = $state(false);

	async function handleGenerateClick() {
		if (goingToGenerate) return;
		goingToGenerate = true;
		try {
			await onGenerateCertificates();
		} finally {
			goingToGenerate = false;
		}
	}

	let modalName = $state('');
	let checkedProps = $state<Record<string, boolean>>({});
	let selectedValues = $state<Record<string, string[]>>({});

	const activeTemplate = $derived(templates.find((t) => t.id === activeTemplateId) ?? templates[0]);

	function addFilterValue(propKey: string, value: string) {
		const trimmed = value.trim();
		if (!trimmed) return;
		const current = selectedValues[propKey] ?? [];
		if (current.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
		selectedValues[propKey] = [...current, trimmed];
	}

	function removeFilterValue(propKey: string, value: string) {
		selectedValues[propKey] = (selectedValues[propKey] ?? []).filter((v) => v !== value);
	}

	function resetChecklist(tpl?: TemplateRecord) {
		const nextChecked: Record<string, boolean> = {};
		const nextValues: Record<string, string[]> = {};
		const rankKey = properties.some((p) => p.key === 'rank') ? 'rank' : 'ranking';

		for (const prop of properties) {
			nextChecked[prop.key] = false;
			nextValues[prop.key] = [];
		}

		if (tpl) {
			const existingFilters = tpl.rankingRule?.propertyFilters ?? {};
			for (const [rawKey, vals] of Object.entries(existingFilters)) {
				const key =
					rawKey === 'ranking' && rankKey === 'rank'
						? 'rank'
						: rawKey === 'rank' && rankKey === 'ranking'
							? 'ranking'
							: rawKey;
				nextChecked[key] = true;
				nextValues[key] = [...vals];
			}
			// Keep backward compatibility with templates created using assignedRoles or rankingRule.
			if (tpl.assignedRoles.length > 0 && !nextChecked.role) {
				nextChecked.role = true;
				nextValues.role = [...tpl.assignedRoles];
			}
			if (tpl.rankingRule?.mode === 'has_ranking' && !nextChecked[rankKey]) {
				nextChecked[rankKey] = true;
				nextValues[rankKey] = [];
			} else if (tpl.rankingRule?.mode === 'specific_rankings' && !nextChecked[rankKey]) {
				nextChecked[rankKey] = true;
				nextValues[rankKey] = [...(tpl.rankingRule.values ?? [])];
			}
		}

		checkedProps = nextChecked;
		selectedValues = nextValues;
	}

	function buildPayloadFromChecklist() {
		const propertyFilters: Record<string, string[]> = {};
		for (const prop of properties) {
			if (checkedProps[prop.key]) {
				propertyFilters[prop.key] = [...(selectedValues[prop.key] ?? [])];
			}
		}

		const assignedRoles = checkedProps.role ? [...(selectedValues.role ?? [])] : [];
		let rankingRule: TemplateRankingRule = { mode: 'any', propertyFilters };

		const rankKey = properties.some((p) => p.key === 'rank') ? 'rank' : 'ranking';
		if (checkedProps[rankKey]) {
			const rankVals = [...(selectedValues[rankKey] ?? [])];
			rankingRule =
				rankVals.length > 0
					? { mode: 'specific_rankings', values: rankVals, propertyFilters }
					: { mode: 'has_ranking', propertyFilters };
		}

		return {
			name: modalName.trim(),
			assignedRoles,
			rankingRule
		};
	}

	function handleSelectChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value === ADD_NEW_VALUE) {
			select.value = activeTemplateId;
			modalName = '';
			resetChecklist();
			showNewModal = true;
			return;
		}
		onSelectTemplate(select.value);
	}

	function openEditModal() {
		if (!activeTemplate) return;
		modalName = activeTemplate.name;
		resetChecklist(activeTemplate);
		confirmingDelete = false;
		showEditModal = true;
	}

	async function handleConfirmDelete() {
		if (templates.length <= 1 || deletingTemplate) return;
		deletingTemplate = true;
		try {
			await onDeleteTemplate();
			confirmingDelete = false;
			showEditModal = false;
		} finally {
			deletingTemplate = false;
		}
	}

	async function submitNewTemplate(event: SubmitEvent) {
		event.preventDefault();
		if (!modalName.trim()) return;
		await onCreateTemplate(buildPayloadFromChecklist());
		showNewModal = false;
	}

	async function submitEditTemplate(event: SubmitEvent) {
		event.preventDefault();
		if (!modalName.trim()) return;
		await onUpdateTemplateRules(buildPayloadFromChecklist());
		showEditModal = false;
	}

	const activeSummaryLabel = $derived.by(() => {
		if (!activeTemplate) return 'Bind Properties';
		const parts: string[] = [];
		if (activeTemplate.assignedRoles.length > 0) {
			parts.push(activeTemplate.assignedRoles.join(', '));
		}
		const filters = activeTemplate.rankingRule?.propertyFilters ?? {};
		for (const [k, vals] of Object.entries(filters)) {
			if (k === 'role') continue;
			parts.push(vals.length > 0 ? `${k}: ${vals.join(', ')}` : `has ${k}`);
		}
		if (parts.length === 0) return 'Bind Properties';
		return parts.join(' · ');
	});
</script>

<div
	class="flex shrink-0 flex-col gap-2 border-b border-border-default bg-surface-card px-3 py-2 sm:px-4 lg:flex-row lg:items-center lg:justify-between"
>
	<!-- Simplified Template Selector & Active Binding Pill -->
	<div class="flex min-w-0 items-center gap-2">
		<select
			aria-label="Certificate template"
			value={activeTemplateId}
			onchange={handleSelectChange}
			class="min-h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-white px-2.5 py-1.5 text-xs font-medium text-ink-primary sm:max-w-xs sm:flex-initial sm:text-sm"
		>
			{#each templates as tpl (tpl.id)}
				<option value={tpl.id}>
					{tpl.name}
					{tpl.assignedRoles.length ? ` — ${tpl.assignedRoles.join(', ')}` : ''}
				</option>
			{/each}
			<option value={ADD_NEW_VALUE}>+ Add New Template...</option>
		</select>

		{#if activeTemplate}
			<button
				type="button"
				onclick={openEditModal}
				title="Rename template or select matching properties"
				class="inline-flex min-h-8 max-w-52 shrink-0 items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100"
			>
				<span class="truncate">{activeSummaryLabel}</span>
				<Pencil class="h-3 w-3 shrink-0 text-indigo-600" />
			</button>
		{/if}

		<Button
			size="sm"
			variant="primary"
			class="ml-auto shrink-0 lg:hidden"
			disabled={saving || !editor.dirty}
			onclick={onSaveTemplate}
		>
			<Save class="h-3.5 w-3.5" />
			{saving ? 'Saving...' : editor.dirty ? 'Save' : 'Saved'}
		</Button>
	</div>

	<!-- Editor Controls -->
	<div class="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0 lg:pb-0">
		<Button
			size="sm"
			variant="ghost"
			aria-label="Undo"
			disabled={!editor.canUndo}
			onclick={() => editor.undo()}
		>
			<Undo2 class="h-3.5 w-3.5" />
		</Button>
		<Button
			size="sm"
			variant="ghost"
			aria-label="Redo"
			disabled={!editor.canRedo}
			onclick={() => editor.redo()}
		>
			<Redo2 class="h-3.5 w-3.5" />
		</Button>

		<div class="mx-0.5 h-4 w-px shrink-0 bg-border-default"></div>

		<Button
			size="sm"
			variant="ghost"
			aria-label="Zoom out"
			onclick={() => editor.setManualZoom(editor.zoom - 0.1)}
		>
			<ZoomOut class="h-3.5 w-3.5" />
		</Button>
		<span class="min-w-10 shrink-0 text-center text-xs font-medium text-ink-secondary">
			{Math.round(editor.zoom * 100)}%
		</span>
		<Button
			size="sm"
			variant="ghost"
			aria-label="Zoom in"
			onclick={() => editor.setManualZoom(editor.zoom + 0.1)}
		>
			<ZoomIn class="h-3.5 w-3.5" />
		</Button>
		<Button
			size="sm"
			variant={editor.autoFitZoom ? 'secondary' : 'ghost'}
			aria-label="Fit canvas to screen"
			onclick={() => editor.enableAutoFitZoom()}
		>
			<Maximize2 class="h-3.5 w-3.5" />
			Fit
		</Button>

		<Button
			size="sm"
			class="shrink-0"
			variant={editor.previewMode === 'placeholders' ? 'primary' : 'secondary'}
			onclick={() =>
				(editor.previewMode = editor.previewMode === 'sample' ? 'placeholders' : 'sample')}
		>
			<Eye class="h-3.5 w-3.5" />
			{editor.previewMode === 'sample' ? 'Value' : 'Placeholder'}
		</Button>

		<Button
			size="sm"
			class="shrink-0"
			disabled={goingToGenerate || saving}
			onclick={handleGenerateClick}
		>
			{goingToGenerate ? 'Opening...' : 'Generate'}
			<ArrowRight class="h-3.5 w-3.5" />
		</Button>

		<Button
			size="sm"
			variant="primary"
			class="hidden shrink-0 lg:inline-flex"
			disabled={saving || !editor.dirty}
			onclick={onSaveTemplate}
		>
			<Save class="h-3.5 w-3.5" />
			{saving ? 'Saving...' : editor.dirty ? 'Save' : 'Saved'}
		</Button>
	</div>
</div>

{#snippet propertyChecklist()}
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium text-ink-primary">Match Properties</legend>
		<p class="text-xs text-ink-muted">
			Select any property to bind this template. Choose values from your data table or keep "Any
			filled value".
		</p>

		<div class="divide-y divide-border-default rounded-xl border border-border-default bg-surface-page">
			{#each properties as prop (prop.key)}
				{@const isChecked = Boolean(checkedProps[prop.key])}
				{@const chosen = selectedValues[prop.key] ?? []}
				{@const tableValues = propertyValueOptions[prop.key] ?? []}
				{@const remaining = tableValues.filter(
					(v) => !chosen.some((c) => c.toLowerCase() === v.toLowerCase())
				)}
				<div class="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
					<label class="flex min-w-40 cursor-pointer items-center gap-2.5 text-sm text-ink-primary">
						<input
							type="checkbox"
							checked={isChecked}
							onchange={(e) => (checkedProps[prop.key] = e.currentTarget.checked)}
							class="h-4 w-4 shrink-0 rounded border-border-strong accent-accent"
						/>
						<span class="font-medium">{prop.label}</span>
						<code class="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">
							{`{{${prop.key}}}`}
						</code>
					</label>

					{#if isChecked}
						<div class="flex min-w-0 flex-1 flex-col gap-1.5">
							{#if chosen.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each chosen as val (val)}
										<span
											class="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800"
										>
											{val}
											<button
												type="button"
												aria-label="Remove {val}"
												onclick={() => removeFilterValue(prop.key, val)}
												class="rounded text-indigo-500 hover:bg-indigo-100 hover:text-indigo-900"
											>
												<X class="h-3 w-3" />
											</button>
										</span>
									{/each}
								</div>
							{/if}

							{#if chosen.length === 0 || remaining.length > 0}
								<select
									aria-label="Match value for {prop.label}"
									value=""
									onchange={(e) => {
										const val = e.currentTarget.value;
										if (val) addFilterValue(prop.key, val);
										e.currentTarget.value = '';
									}}
									class="min-h-8 w-full rounded-lg border border-border-strong bg-white px-2.5 py-1 text-xs text-ink-primary outline-none transition focus:border-accent"
								>
									<option value="">
										{chosen.length > 0 ? '+ Add another value...' : 'Any filled value'}
									</option>
									{#each remaining as opt (opt)}
										<option value={opt}>{opt}</option>
									{/each}
									{#if tableValues.length === 0}
										<option value="" disabled>No saved values in Data & Mapping table yet</option>
									{/if}
								</select>
							{/if}
						</div>
					{:else}
						<div
							aria-disabled="true"
							class="flex min-h-8 w-full flex-1 cursor-not-allowed items-center rounded-lg bg-surface-subtle/70 px-2.5 py-1 text-xs text-ink-muted select-none"
						>
							Not selected
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</fieldset>
{/snippet}

<!-- Add Template Modal -->
<Modal
	bind:open={showNewModal}
	title="Add Certificate Template"
	description="Enter a template name and select any properties that match this template."
>
	<form class="space-y-4" onsubmit={submitNewTemplate}>
		<div>
			<label for="new-tpl-name" class="block text-sm font-medium text-ink-primary">
				Template Name
			</label>
			<input
				id="new-tpl-name"
				type="text"
				required
				bind:value={modalName}
				placeholder="e.g. Organiser Certificate"
				class="mt-1 block min-h-10 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
			/>
		</div>

		{@render propertyChecklist()}

		<div class="flex justify-end gap-2 pt-2">
			<Button onclick={() => (showNewModal = false)}>Cancel</Button>
			<Button type="submit" variant="primary">Add Template</Button>
		</div>
	</form>
</Modal>

<!-- Edit Template Modal -->
<Modal
	bind:open={showEditModal}
	title="Template Settings"
	description="Rename this template and select the properties that match it."
>
	<form class="space-y-4" onsubmit={submitEditTemplate}>
		<div>
			<label for="edit-tpl-name" class="block text-sm font-medium text-ink-primary">
				Template Name
			</label>
			<input
				id="edit-tpl-name"
				type="text"
				required
				bind:value={modalName}
				class="mt-1 block min-h-10 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
			/>
		</div>

		{@render propertyChecklist()}

		{#if confirmingDelete}
			<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
				<p class="font-semibold">Delete "{activeTemplate?.name}"?</p>
				<p class="mt-1 text-red-700">
					Warning: this removes the template permanently. Any generated certificates using it switch
					to the default template.
				</p>
				<div class="mt-3 flex justify-end gap-2">
					<Button size="sm" onclick={() => (confirmingDelete = false)}>Keep Template</Button>
					<Button
						size="sm"
						variant="danger"
						disabled={deletingTemplate}
						onclick={handleConfirmDelete}
					>
						{deletingTemplate ? 'Deleting...' : 'Confirm Delete'}
					</Button>
				</div>
			</div>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2 pt-2">
				{#if templates.length > 1}
					<Button
						type="button"
						variant="danger"
						size="sm"
						onclick={() => (confirmingDelete = true)}
					>
						<Trash2 class="h-3.5 w-3.5" />
						Delete Template
					</Button>
				{:else}
					<span class="text-xs text-ink-muted">A project must keep at least one template.</span>
				{/if}

				<div class="flex items-center gap-2">
					<Button onclick={() => (showEditModal = false)}>Cancel</Button>
					<Button type="submit" variant="primary">Save</Button>
				</div>
			</div>
		{/if}
	</form>
</Modal>
