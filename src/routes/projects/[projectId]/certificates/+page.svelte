<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Archive,
		ChevronDown,
		Download,
		Eye,
		EyeOff,
		FileImage,
		FileText,
		RefreshCw
	} from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import CertificatePreviewPane from '#lib/features/certificates/CertificatePreviewPane.svelte';
	import CertificatePropertiesPanel, {
		type CertificateDraft
	} from '#lib/features/certificates/CertificatePropertiesPanel.svelte';
	import {
		buildBulkCertificatesZip,
		formatMimeType,
		renderCertificateBytes,
		triggerFileDownload
	} from '#lib/features/certificates/renderer.ts';
	import type { ExportFormat } from '#lib/types/certflow.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let selectedCertId = $state<string | null>(null);
	let liveDraft = $state<CertificateDraft | null>(null);
	let showPreview = $state(true);
	let roleFilter = $state('all');
	let generating = $state(false);
	let saving = $state(false);
	let exporting = $state(false);
	let exportingLabel = $state<string | null>(null);
	let showExportMenu = $state(false);
	let exportTriggerEl = $state<HTMLDivElement | null>(null);
	let exportMenuPos = $state({ top: 0, left: 16 });
	let message = $state('');

	const roles = $derived(Array.from(new Set(data.certificates.map((c) => c.role))).sort());

	const filteredCertificates = $derived(
		roleFilter === 'all'
			? data.certificates
			: data.certificates.filter((c) => c.role === roleFilter)
	);

	// Keep the first certificate selected automatically so the preview pane opens immediately.
	$effect(() => {
		if (filteredCertificates.length === 0) {
			selectedCertId = null;
			liveDraft = null;
			return;
		}
		if (!selectedCertId || !filteredCertificates.some((c) => c.id === selectedCertId)) {
			selectedCertId = filteredCertificates[0].id;
			liveDraft = null;
		}
	});

	const selectedCertificate = $derived(
		filteredCertificates.find((c) => c.id === selectedCertId) ?? null
	);

	const previewTemplate = $derived.by(() => {
		if (!selectedCertificate) return null;
		const tplId = liveDraft?.templateId || selectedCertificate.templateId;
		return (
			data.templates.find((t) => t.id === tplId) ??
			data.templates.find((t) => t.id === selectedCertificate.templateId) ??
			null
		);
	});

	const previewData = $derived.by<Record<string, string>>(() => {
		if (!selectedCertificate) return {};
		const name = liveDraft?.recipientName ?? selectedCertificate.recipientName;
		const title = liveDraft?.certTitle ?? selectedCertificate.certTitle;
		const role = liveDraft?.role ?? selectedCertificate.role;
		const rank = liveDraft?.ranking ?? selectedCertificate.ranking;
		const email = liveDraft?.email ?? selectedCertificate.email ?? '';
		return {
			name,
			title,
			role,
			rank,
			ranking: rank,
			email,
			...(selectedCertificate.customProperties ?? {})
		};
	});

	async function handleGenerateAll() {
		generating = true;
		message = '';
		try {
			const res = await fetch(`/api/projects/${data.project.id}/certificates/generate`, {
				method: 'POST'
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not generate certificates.');
			}
			const body = await res.json();
			await invalidateAll();
			selectedCertId = null;
			message = `Generated ${body.generatedCount} certificates from your template rules.`;
		} catch (err) {
			message = err instanceof Error ? err.message : 'Generation failed.';
		} finally {
			generating = false;
		}
	}

	async function handleSaveProperties(patch: {
		templateId: string;
		certName: string;
		recipientName: string;
		certTitle: string;
		role: string;
		ranking: string;
		email: string | null;
	}) {
		if (!selectedCertificate) return;
		saving = true;
		message = '';
		try {
			const res = await fetch(
				`/api/projects/${data.project.id}/certificates/${selectedCertificate.id}`,
				{
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(patch)
				}
			);
			if (!res.ok) throw new Error('Could not save certificate properties.');
			await invalidateAll();
			message = `Updated properties for ${patch.recipientName}.`;
		} catch (err) {
			message = err instanceof Error ? err.message : 'Save failed.';
		} finally {
			saving = false;
		}
	}

	function buildRenderData(cert: (typeof data.certificates)[number]): Record<string, string> {
		return {
			name: cert.recipientName,
			title: cert.certTitle,
			role: cert.role,
			rank: cert.ranking,
			ranking: cert.ranking,
			email: cert.email ?? '',
			...(cert.customProperties ?? {})
		};
	}

	function toggleExportMenu() {
		if (!showExportMenu && exportTriggerEl) {
			const rect = exportTriggerEl.getBoundingClientRect();
			const menuWidth = 256;
			const menuHeight = selectedCertificate ? 376 : 210;
			const openUpward = rect.bottom + menuHeight + 12 > window.innerHeight;
			const top = openUpward
				? Math.max(8, Math.round(rect.top - menuHeight - 6))
				: Math.round(rect.bottom + 6);
			const left = Math.max(
				8,
				Math.min(Math.round(rect.right - menuWidth), window.innerWidth - menuWidth - 8)
			);
			exportMenuPos = { top, left };
		}
		showExportMenu = !showExportMenu;
	}

	async function handleSingleExport(format: ExportFormat) {
		showExportMenu = false;
		if (!selectedCertificate) return;
		const tpl = data.templates.find((t) => t.id === selectedCertificate.templateId);
		if (!tpl) return;

		exporting = true;
		exportingLabel = format.toUpperCase();
		try {
			const bytes = await renderCertificateBytes({
				width: tpl.width,
				height: tpl.height,
				canvasState: tpl.canvasState,
				data: buildRenderData(selectedCertificate),
				format
			});
			const safe = selectedCertificate.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			triggerFileDownload(
				bytes,
				`${safe}-${selectedCertificate.certCode}.${format}`,
				formatMimeType(format)
			);
		} finally {
			exporting = false;
			exportingLabel = null;
		}
	}

	async function handleBulkZipExport(format: ExportFormat) {
		showExportMenu = false;
		if (filteredCertificates.length === 0) return;
		exporting = true;
		exportingLabel = `ZIP (${format.toUpperCase()})`;
		message = `Rendering ${filteredCertificates.length} certificates as ${format.toUpperCase()}...`;
		try {
			const files: Array<{ fileName: string; bytes: Uint8Array }> = [];
			for (const cert of filteredCertificates) {
				const tpl = data.templates.find((t) => t.id === cert.templateId);
				if (!tpl) continue;
				const bytes = await renderCertificateBytes({
					width: tpl.width,
					height: tpl.height,
					canvasState: tpl.canvasState,
					data: buildRenderData(cert),
					format
				});
				const safe = cert.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
				files.push({
					fileName: `${cert.role}/${safe}-${cert.certCode}.${format}`,
					bytes
				});
			}
			const zipBytes = await buildBulkCertificatesZip(files);
			const projSlug = data.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			triggerFileDownload(zipBytes, `${projSlug}-certificates-${format}.zip`, 'application/zip');
			message = `Downloaded ZIP with ${files.length} ${format.toUpperCase()} certificates.`;
		} finally {
			exporting = false;
			exportingLabel = null;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && showExportMenu) showExportMenu = false;
	}}
/>

<main class="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h2 class="text-lg font-bold text-ink-primary">Generate Certificates</h2>
			<p class="mt-1 text-sm text-ink-secondary">
				Select a certificate from the list to preview or edit its properties. Export single files or
				a ZIP archive as PDF, PNG or JPG.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if filteredCertificates.length > 0}
				<Button
					size="sm"
					variant={showPreview ? 'secondary' : 'ghost'}
					onclick={() => (showPreview = !showPreview)}
				>
					{#if showPreview}
						<EyeOff class="h-4 w-4" />
						Hide Preview
					{:else}
						<Eye class="h-4 w-4" />
						Show Preview
					{/if}
				</Button>
			{/if}

			<Button variant="primary" disabled={generating} onclick={handleGenerateAll}>
				<RefreshCw class="h-4 w-4 {generating ? 'animate-spin' : ''}" />
				{generating ? 'Generating...' : 'Generate from Dataset'}
			</Button>

			{#if filteredCertificates.length > 0}
				<div bind:this={exportTriggerEl} class="shrink-0">
					<Button
						aria-haspopup="menu"
						aria-expanded={showExportMenu}
						disabled={exporting}
						onclick={toggleExportMenu}
					>
						<Download class="h-4 w-4" />
						{exportingLabel ? `Exporting ${exportingLabel}...` : 'Export'}
						<ChevronDown class="h-4 w-4 text-ink-muted" />
					</Button>
				</div>
			{/if}
		</div>
	</div>

	{#if message}
		<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			{message}
		</div>
	{/if}

	{#if data.certificates.length === 0}
		<EmptyState
			title="No certificates generated yet"
			description="Add rows or import a file in Data & Mapping, then click Generate from Dataset."
		>
			{#snippet action()}
				<Button variant="primary" disabled={generating} onclick={handleGenerateAll}>
					Generate from Dataset
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Role Filter Pills -->
		<div class="flex flex-wrap items-center gap-1.5">
			<button
				type="button"
				onclick={() => (roleFilter = 'all')}
				class="rounded-full border px-3 py-1 text-xs font-medium {roleFilter === 'all'
					? 'border-amber-500 bg-amber-50 text-amber-900'
					: 'border-border-default bg-white text-ink-secondary'}"
			>
				All ({data.certificates.length})
			</button>
			{#each roles as role (role)}
				<button
					type="button"
					onclick={() => (roleFilter = role)}
					class="rounded-full border px-3 py-1 text-xs font-medium {roleFilter === role
						? 'border-amber-500 bg-amber-50 text-amber-900'
						: 'border-border-default bg-white text-ink-secondary'}"
				>
					{role}
				</button>
			{/each}
		</div>

		<!-- Numbered List + Live Preview Pane + Selected Properties Inspector -->
		<div class="grid items-start gap-4 lg:grid-cols-12">
			<div
				class="overflow-hidden rounded-xl border border-border-default bg-surface-card {showPreview
					? 'lg:col-span-4 xl:col-span-3'
					: 'lg:col-span-5'}"
			>
				<div class="border-b border-border-default px-4 py-3">
					<h3 class="text-xs font-semibold tracking-wide text-ink-secondary uppercase">
						Certificates ({filteredCertificates.length})
					</h3>
				</div>
				<ul class="max-h-[640px] divide-y divide-border-default overflow-y-auto">
					{#each filteredCertificates as cert, idx (cert.id)}
						<li>
							<button
								type="button"
								onclick={() => {
									selectedCertId = cert.id;
									liveDraft = null;
								}}
								class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition {selectedCertId ===
								cert.id
									? 'bg-amber-50 font-semibold text-amber-950'
									: 'hover:bg-surface-subtle'}"
							>
								<span class="min-w-0 truncate">
									<span class="mr-2 font-mono text-xs text-ink-muted">{idx + 1}.</span>
									{cert.recipientName}
								</span>
								<Badge tone={cert.email ? 'emerald' : 'neutral'}>{cert.role}</Badge>
							</button>
						</li>
					{/each}
				</ul>
			</div>

			{#if showPreview}
				<div class="lg:col-span-8 xl:sticky xl:top-4 xl:col-span-5">
					{#if selectedCertificate && previewTemplate}
						<CertificatePreviewPane
							templateName={previewTemplate.name}
							width={previewTemplate.width}
							height={previewTemplate.height}
							canvasState={previewTemplate.canvasState}
							data={previewData}
							recipientName={liveDraft?.recipientName ?? selectedCertificate.recipientName}
							certCode={selectedCertificate.certCode}
						/>
					{:else}
						<EmptyState
							title="No preview available"
							description="Select a certificate with an assigned template to view the live preview."
						/>
					{/if}
				</div>
			{/if}

			<div class={showPreview ? 'lg:col-span-12 xl:col-span-4' : 'lg:col-span-7'}>
				{#if selectedCertificate}
					<CertificatePropertiesPanel
						certificate={selectedCertificate}
						templates={data.templates.map((t) => ({ id: t.id, name: t.name }))}
						{saving}
						onSave={handleSaveProperties}
						onDraftChange={(draft) => (liveDraft = draft)}
					/>
				{:else}
					<EmptyState
						title="Select a certificate"
						description="Select a recipient from the list to inspect or edit the certificate properties."
					/>
				{/if}
			</div>
		</div>
	{/if}
</main>

{#if showExportMenu}
	<div
		role="presentation"
		onclick={() => (showExportMenu = false)}
		class="fixed inset-0 z-40"
	></div>
	<div
		role="menu"
		aria-label="Export certificates"
		style="top: {exportMenuPos.top}px; left: {exportMenuPos.left}px;"
		class="fixed z-50 w-64 rounded-xl border border-border-default bg-surface-card p-1.5 shadow-lg"
	>
		{#if selectedCertificate}
			<div class="px-2.5 py-1">
				<p class="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
					Selected Certificate
				</p>
				<p class="truncate text-[11px] text-ink-secondary">
					{selectedCertificate.recipientName}
				</p>
			</div>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleSingleExport('png')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<FileImage class="h-4 w-4 shrink-0 text-indigo-600" />
				<span>
					<span class="block font-semibold">PNG</span>
					<span class="block text-[11px] text-ink-muted">High-resolution image</span>
				</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleSingleExport('jpg')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<FileImage class="h-4 w-4 shrink-0 text-emerald-600" />
				<span>
					<span class="block font-semibold">JPG</span>
					<span class="block text-[11px] text-ink-muted">Smaller image file</span>
				</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleSingleExport('pdf')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<FileText class="h-4 w-4 shrink-0 text-amber-600" />
				<span>
					<span class="block font-semibold">PDF</span>
					<span class="block text-[11px] text-ink-muted">Print-ready document</span>
				</span>
			</button>
		{/if}

		<div class={selectedCertificate ? 'mt-1.5 border-t border-border-default pt-1.5' : ''}>
			<p class="px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
				Download ZIP ({filteredCertificates.length})
			</p>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleBulkZipExport('png')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<Archive class="h-4 w-4 shrink-0 text-indigo-600" />
				<span>
					<span class="block font-semibold">ZIP — PNG</span>
					<span class="block text-[11px] text-ink-muted">
						{filteredCertificates.length === 1
							? '1 PNG image in ZIP'
							: `All ${filteredCertificates.length} as PNG images`}
					</span>
				</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleBulkZipExport('jpg')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<Archive class="h-4 w-4 shrink-0 text-emerald-600" />
				<span>
					<span class="block font-semibold">ZIP — JPG</span>
					<span class="block text-[11px] text-ink-muted">
						{filteredCertificates.length === 1
							? '1 JPG image in ZIP'
							: `All ${filteredCertificates.length} as JPG images`}
					</span>
				</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleBulkZipExport('pdf')}
				class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-ink-primary transition hover:bg-surface-subtle"
			>
				<Archive class="h-4 w-4 shrink-0 text-amber-600" />
				<span>
					<span class="block font-semibold">ZIP — PDF</span>
					<span class="block text-[11px] text-ink-muted">
						{filteredCertificates.length === 1
							? '1 PDF document in ZIP'
							: `All ${filteredCertificates.length} as PDF documents`}
					</span>
				</span>
			</button>
		</div>
	</div>
{/if}
