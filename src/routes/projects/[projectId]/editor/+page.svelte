<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { ChevronDown, ChevronUp, Layers, Sliders } from '@lucide/svelte';
	import { getViewportTier } from '#lib/config/layout.ts';
	import CertificateCanvas from '#lib/features/editor/CertificateCanvas.svelte';
	import EditorToolbox from '#lib/features/editor/EditorToolbox.svelte';
	import ElementInspector from '#lib/features/editor/ElementInspector.svelte';
	import TemplateBar from '#lib/features/editor/TemplateBar.svelte';
	import { EditorState } from '#lib/features/editor/editor-state.svelte.ts';
	import type { TemplateRankingRule } from '#lib/types/certflow.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const editor = new EditorState();
	const firstTemplate = untrack(() => data.templates[0]);
	let activeTemplateId = $state(firstTemplate?.id ?? '');
	if (firstTemplate) {
		editor.loadTemplate({
			width: firstTemplate.width,
			height: firstTemplate.height,
			canvasState: firstTemplate.canvasState
		});
	}
	let loadedTemplateId = firstTemplate?.id ?? '';
	let saving = $state(false);
	let statusMessage = $state('');
	let viewportWidth = $state(1280);
	// Controls which panel is expanded below the canvas on mobile (< 768px).
	let mobilePanel = $state<'none' | 'toolbox' | 'inspector'>('toolbox');

	// Resizable desktop side panel widths (px), clamped cleanly within ergonomic bounds.
	let leftPanelWidth = $state(260);
	let rightPanelWidth = $state(320);
	let resizingSide = $state<'left' | 'right' | null>(null);
	let resizeStartX = 0;
	let resizeStartWidth = 0;

	const viewportTier = $derived(getViewportTier(viewportWidth));

	function startPanelResize(side: 'left' | 'right', event: PointerEvent) {
		event.preventDefault();
		resizingSide = side;
		resizeStartX = event.clientX;
		resizeStartWidth = side === 'left' ? leftPanelWidth : rightPanelWidth;

		const onMove = (moveEvent: PointerEvent) => {
			const dx = moveEvent.clientX - resizeStartX;
			if (side === 'left') {
				leftPanelWidth = Math.max(200, Math.min(440, resizeStartWidth + dx));
			} else {
				rightPanelWidth = Math.max(240, Math.min(480, resizeStartWidth - dx));
			}
		};

		const onUp = () => {
			resizingSide = null;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}

	const activeTemplate = $derived(
		data.templates.find((t) => t.id === activeTemplateId) ?? data.templates[0]
	);

	const propertyValueOptions = $derived.by(() => {
		const map: Record<string, string[]> = {};
		for (const prop of data.project.criteriaConfig) {
			const seen = new Set<string>();
			const list: string[] = [];
			for (const recipient of data.recipients) {
				const rawVal =
					recipient.mappedData?.[prop.key] ??
					(prop.key === 'rank'
						? recipient.mappedData?.ranking
						: prop.key === 'ranking'
							? recipient.mappedData?.rank
							: '');
				const val = (rawVal ?? '').trim();
				if (!val) continue;
				const lower = val.toLowerCase();
				if (seen.has(lower)) continue;
				seen.add(lower);
				list.push(val);
			}
			list.sort((a, b) => a.localeCompare(b));
			map[prop.key] = list;
		}
		return map;
	});

	const sampleData = $derived.by(() => {
		const first = data.recipients[0]?.mappedData;
		if (first && Object.keys(first).length > 0) return first;
		return {
			name: 'Aiman Hakim bin Zulkifli',
			title: data.project.defaultCertTitle || data.project.name,
			role: activeTemplate?.assignedRoles[0] ?? 'Participant',
			rank: '',
			ranking: '',
			email: 'aiman@example.com'
		};
	});

	$effect(() => {
		if (!activeTemplateId && data.templates[0]) {
			activeTemplateId = data.templates[0].id;
		}
	});

	$effect(() => {
		if (activeTemplate && activeTemplate.id !== loadedTemplateId) {
			loadedTemplateId = activeTemplate.id;
			editor.loadTemplate({
				width: activeTemplate.width,
				height: activeTemplate.height,
				canvasState: activeTemplate.canvasState
			});
		}
	});

	function handleSelectTemplate(templateId: string) {
		activeTemplateId = templateId;
		statusMessage = '';
	}

	async function handleSaveTemplate() {
		if (!activeTemplate) return;
		saving = true;
		statusMessage = '';
		try {
			const res = await fetch(
				`/api/projects/${data.project.id}/templates/${activeTemplate.id}`,
				{
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						width: editor.width,
						height: editor.height,
						canvasState: editor.canvasState
					})
				}
			);
			if (!res.ok) throw new Error('Failed to save template.');
			editor.markSaved();
			statusMessage = 'Template saved.';
			await invalidateAll();
		} catch (err) {
			statusMessage = err instanceof Error ? err.message : 'Save failed.';
		} finally {
			saving = false;
		}
	}

	async function handleCreateTemplate(payload: {
		name: string;
		assignedRoles: string[];
		rankingRule: TemplateRankingRule;
	}) {
		const res = await fetch(`/api/projects/${data.project.id}/templates`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!res.ok) {
			statusMessage = 'Could not create the template.';
			return;
		}
		const body = await res.json();
		await invalidateAll();
		activeTemplateId = body.template.id;
		statusMessage = `Created template "${payload.name}".`;
	}

	async function handleUpdateTemplateRules(payload: {
		name: string;
		assignedRoles: string[];
		rankingRule: TemplateRankingRule;
	}) {
		if (!activeTemplate) return;
		const res = await fetch(`/api/projects/${data.project.id}/templates/${activeTemplate.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		if (!res.ok) {
			statusMessage = 'Could not update the template settings.';
			return;
		}
		await invalidateAll();
		statusMessage = 'Template settings updated.';
	}

	async function handleDeleteTemplate() {
		if (!activeTemplate) return;
		const deletedName = activeTemplate.name;
		const res = await fetch(`/api/projects/${data.project.id}/templates/${activeTemplate.id}`, {
			method: 'DELETE'
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			statusMessage = err.message ?? 'Could not delete the template.';
			return;
		}
		const body = await res.json();
		await invalidateAll();
		activeTemplateId = body.nextTemplateId ?? data.templates[0]?.id ?? '';
		statusMessage = `Deleted template "${deletedName}".`;
	}

	async function handleGenerateCertificates() {
		if (editor.dirty) {
			await handleSaveTemplate();
		}
		await goto(`/projects/${data.project.id}/certificates`);
	}
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<div class="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-hidden">
	<TemplateBar
		templates={data.templates}
		properties={data.project.criteriaConfig}
		{propertyValueOptions}
		activeTemplateId={activeTemplate?.id ?? ''}
		{editor}
		{saving}
		onSelectTemplate={handleSelectTemplate}
		onSaveTemplate={handleSaveTemplate}
		onCreateTemplate={handleCreateTemplate}
		onUpdateTemplateRules={handleUpdateTemplateRules}
		onDeleteTemplate={handleDeleteTemplate}
		onGenerateCertificates={handleGenerateCertificates}
	/>

	{#if statusMessage}
		<div class="shrink-0 border-b border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs text-indigo-800">
			{statusMessage}
		</div>
	{/if}

	<!--
		3-Tier Responsive Editor Layout (single mounted instance per panel — no duplicate DOM IDs):
		- Mobile (< 768px): Canvas pinned on top + compact tab bar switching Elements & Inspector below.
		- Tablet (768px - 1023px): Canvas on top + 2-column Toolbox & Inspector split below.
		- Desktop (>= 1024px): Viewport-locked 3-column studio; main canvas stays fixed, only side panels scroll.
	-->
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row lg:overflow-hidden {resizingSide
			? 'select-none'
			: ''}"
	>
		{#if viewportTier === 'desktop'}
			<div
				style="width: {leftPanelWidth}px;"
				class="flex h-full min-h-0 shrink-0 overflow-hidden"
			>
				<EditorToolbox {editor} criteria={data.project.criteriaConfig} projectId={data.project.id} />
			</div>
			<!-- Left Resizable Divider -->
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize left panel"
				title="Drag to resize (double-click to reset)"
				onpointerdown={(e) => startPanelResize('left', e)}
				ondblclick={() => (leftPanelWidth = 260)}
				class="w-1.5 shrink-0 cursor-col-resize border-r border-border-default bg-surface-card transition hover:bg-accent/30 {resizingSide ===
				'left'
					? 'bg-accent/50'
					: ''}"
			></div>
		{/if}

		<CertificateCanvas {editor} {sampleData} onSaveShortcut={handleSaveTemplate} />

		{#if viewportTier === 'desktop'}
			<!-- Right Resizable Divider -->
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize right panel"
				title="Drag to resize (double-click to reset)"
				onpointerdown={(e) => startPanelResize('right', e)}
				ondblclick={() => (rightPanelWidth = 320)}
				class="w-1.5 shrink-0 cursor-col-resize border-l border-border-default bg-surface-card transition hover:bg-accent/30 {resizingSide ===
				'right'
					? 'bg-accent/50'
					: ''}"
			></div>
			<div
				style="width: {rightPanelWidth}px;"
				class="flex h-full min-h-0 shrink-0 overflow-hidden"
			>
				<ElementInspector
					{editor}
					criteria={data.project.criteriaConfig}
					projectId={data.project.id}
					{sampleData}
					{propertyValueOptions}
				/>
			</div>
		{:else if viewportTier === 'tablet'}
			<div class="grid grid-cols-2 border-t border-border-default bg-surface-card">
				<div class="min-w-0 border-r border-border-default">
					<EditorToolbox {editor} criteria={data.project.criteriaConfig} projectId={data.project.id} />
				</div>
				<div class="min-w-0">
					<ElementInspector
					{editor}
					criteria={data.project.criteriaConfig}
					projectId={data.project.id}
					{sampleData}
					{propertyValueOptions}
				/>
				</div>
			</div>
		{:else}
			<div class="border-t border-border-default bg-surface-card">
				<div class="grid grid-cols-3 gap-1 border-b border-border-default p-2">
					<button
						type="button"
						onclick={() => (mobilePanel = mobilePanel === 'toolbox' ? 'none' : 'toolbox')}
						class="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold {mobilePanel ===
						'toolbox'
							? 'border-accent bg-accent-soft text-accent'
							: 'border-border-default bg-white text-ink-primary'}"
					>
						<Layers class="h-3.5 w-3.5" />
						Elements
					</button>
					<button
						type="button"
						onclick={() => (mobilePanel = mobilePanel === 'inspector' ? 'none' : 'inspector')}
						class="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold {mobilePanel ===
						'inspector'
							? 'border-accent bg-accent-soft text-accent'
							: 'border-border-default bg-white text-ink-primary'}"
					>
						<Sliders class="h-3.5 w-3.5" />
						{editor.selectedIds.length > 1
							? `${editor.selectedIds.length} Selected`
							: editor.selectedElement
								? 'Edit Item'
								: 'Canvas'}
					</button>
					<button
						type="button"
						onclick={() => (mobilePanel = mobilePanel === 'none' ? 'inspector' : 'none')}
						class="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-border-default bg-white px-2 py-1.5 text-xs font-medium text-ink-secondary"
					>
						{#if mobilePanel === 'none'}
							<ChevronUp class="h-3.5 w-3.5" />
							Show
						{:else}
							<ChevronDown class="h-3.5 w-3.5" />
							Hide
						{/if}
					</button>
				</div>

				{#if mobilePanel === 'toolbox'}
					<EditorToolbox {editor} criteria={data.project.criteriaConfig} projectId={data.project.id} />
				{:else if mobilePanel === 'inspector'}
					<ElementInspector
					{editor}
					criteria={data.project.criteriaConfig}
					projectId={data.project.id}
					{sampleData}
					{propertyValueOptions}
				/>
				{/if}
			</div>
		{/if}
	</div>
</div>
