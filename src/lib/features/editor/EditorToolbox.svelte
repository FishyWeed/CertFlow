<script lang="ts">
	import {
		Circle,
		Eye,
		EyeOff,
		GripVertical,
		Group,
		Image as ImageIcon,
		ImagePlus,
		Lock,
		Minus,
		PenTool,
		Square,
		Tag,
		Trash2,
		Type,
		Unlock
	} from '@lucide/svelte';
	import ImageCropResizeModal from '#lib/components/ui/ImageCropResizeModal.svelte';
	import type { CriterionDefinition, ImageEditState } from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';

	interface Props {
		editor: EditorState;
		criteria: CriterionDefinition[];
		projectId: string;
	}

	let { editor, criteria, projectId }: Props = $props();

	let imageInputEl = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);
	let uploadError = $state('');
	let draggingLayerId = $state<string | null>(null);
	let dragOverLayerId = $state<string | null>(null);

	let cropModalOpen = $state(false);
	let pendingImageUrl = $state<string | null>(null);
	let pendingOriginalFile = $state<File | null>(null);
	let pendingImageName = $state('image.png');
	let pendingImageMime = $state('image/png');

	function clearPendingImage() {
		if (pendingImageUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(pendingImageUrl);
		}
		pendingImageUrl = null;
		pendingOriginalFile = null;
	}

	async function uploadAsset(file: File, kind: 'image' | 'background') {
		uploading = true;
		uploadError = '';
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('kind', kind);
			formData.append('projectId', projectId);

			const res = await fetch('/api/assets', { method: 'POST', body: formData });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Asset upload failed.');
			}
			const { asset } = await res.json();
			return asset as { id: string; publicUrl: string; fileName: string };
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed.';
			return null;
		} finally {
			uploading = false;
		}
	}

	function handleOverlayUpload(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		clearPendingImage();
		pendingOriginalFile = file;
		pendingImageUrl = URL.createObjectURL(file);
		pendingImageName = file.name;
		pendingImageMime = file.type || 'image/png';
		cropModalOpen = true;
		input.value = '';
	}

	async function handleApplyCroppedImage(result: {
		file: File;
		width: number;
		height: number;
		editState: ImageEditState;
	}) {
		const origFile = pendingOriginalFile;
		const [croppedAsset, origAsset] = await Promise.all([
			uploadAsset(result.file, 'image'),
			origFile ? uploadAsset(origFile, 'image') : Promise.resolve(null)
		]);
		if (croppedAsset) {
			const maxW = 240;
			const maxH = 180;
			const scale = Math.min(1, maxW / result.width, maxH / result.height);
			editor.addImage(
				croppedAsset.publicUrl,
				croppedAsset.fileName,
				croppedAsset.id,
				{
					width: Math.max(40, Math.round(result.width * scale)),
					height: Math.max(40, Math.round(result.height * scale))
				},
				{
					originalSrc: origAsset?.publicUrl ?? croppedAsset.publicUrl,
					originalAssetId: origAsset?.id ?? croppedAsset.id,
					editState: result.editState
				}
			);
		}
		clearPendingImage();
	}

	function handlePropertyDragStart(event: DragEvent, prop: CriterionDefinition) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('application/x-certflow-property', JSON.stringify(prop));
		event.dataTransfer.setData('text/plain', `{{${prop.key}}}`);
	}

	function handleElementDragStart(
		event: DragEvent,
		kind: 'text' | 'rect' | 'line' | 'circle' | 'signature'
	) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('application/x-certflow-element', kind);
	}

	function handleLayerDragStart(event: DragEvent, id: string) {
		draggingLayerId = id;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('application/x-certflow-layer', id);
		}
	}

	function handleLayerDragOver(event: DragEvent, targetId: string) {
		const sourceId = draggingLayerId;
		if (!sourceId || sourceId === targetId) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverLayerId = targetId;
	}

	function handleLayerDrop(event: DragEvent, targetId: string) {
		event.preventDefault();
		const sourceId =
			draggingLayerId || event.dataTransfer?.getData('application/x-certflow-layer') || null;
		if (sourceId && sourceId !== targetId) {
			editor.reorderLayer(sourceId, targetId);
		}
		draggingLayerId = null;
		dragOverLayerId = null;
	}

	function handleLayerDragEnd() {
		draggingLayerId = null;
		dragOverLayerId = null;
	}
</script>

<aside
	class="flex h-full min-h-0 w-full min-w-0 flex-col gap-5 overflow-y-auto bg-surface-card p-3.5"
>
	<!-- Properties ({{}}) -->
	<section>
		<h2 class="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Properties</h2>
		<p class="mt-1 text-xs text-ink-muted">
			Drag a property onto the certificate or a text box. You can also click to add it.
		</p>
		<div class="mt-2.5 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
			{#each criteria as prop (prop.key)}
				<button
					type="button"
					draggable="true"
					ondragstart={(e) => handlePropertyDragStart(e, prop)}
					onclick={() => editor.addPlaceholder(prop)}
					class="flex cursor-grab items-center justify-between gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2 text-left text-xs font-medium text-indigo-900 transition hover:bg-indigo-100 active:cursor-grabbing"
				>
					<span class="flex min-w-0 items-center gap-1.5 truncate">
						<GripVertical class="h-3.5 w-3.5 shrink-0 text-indigo-400" />
						<span class="truncate">{prop.label}</span>
					</span>
					<code class="shrink-0 text-[10px] text-indigo-600">{`{{${prop.key}}}`}</code>
				</button>
			{/each}
		</div>
	</section>

	<!-- Static Elements -->
	<section class="border-t border-border-default pt-4">
		<h2 class="text-xs font-semibold tracking-wide text-ink-secondary uppercase">Elements</h2>
		<div class="mt-2.5 grid grid-cols-2 gap-1.5">
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleElementDragStart(e, 'text')}
				onclick={() => editor.addStaticText()}
				class="flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle active:cursor-grabbing"
			>
				<Type class="h-3.5 w-3.5" />
				Text
			</button>
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleElementDragStart(e, 'rect')}
				onclick={() => editor.addShape('rect')}
				class="flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle active:cursor-grabbing"
			>
				<Square class="h-3.5 w-3.5" />
				Box
			</button>
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleElementDragStart(e, 'line')}
				onclick={() => editor.addShape('line')}
				class="flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle active:cursor-grabbing"
			>
				<Minus class="h-3.5 w-3.5" />
				Line
			</button>
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleElementDragStart(e, 'circle')}
				onclick={() => editor.addShape('circle')}
				class="flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle active:cursor-grabbing"
			>
				<Circle class="h-3.5 w-3.5" />
				Circle
			</button>
			<button
				type="button"
				disabled={uploading}
				onclick={() => imageInputEl?.click()}
				class="flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle disabled:opacity-50"
			>
				<ImagePlus class="h-3.5 w-3.5" />
				{uploading ? 'Uploading...' : 'Image'}
			</button>
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleElementDragStart(e, 'signature')}
				onclick={() => editor.addSignature()}
				class="flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle active:cursor-grabbing"
			>
				<PenTool class="h-3.5 w-3.5" />
				Signature
			</button>
		</div>

		<input
			bind:this={imageInputEl}
			type="file"
			accept="image/*"
			onchange={handleOverlayUpload}
			class="hidden"
		/>

		{#if uploadError}
			<p class="mt-2 text-[11px] text-red-600">{uploadError}</p>
		{/if}
	</section>

	<!-- Simplified Drag-to-Reorder Layer List -->
	<section class="border-t border-border-default pt-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xs font-semibold tracking-wide text-ink-secondary uppercase">
				Layers ({editor.canvasState.elements.length})
			</h2>
			<span class="text-[10px] text-ink-muted">
				{editor.selectedIds.length > 1
					? `${editor.selectedIds.length} selected`
					: 'Shift+Click multi-select'}
			</span>
		</div>

		<div class="mt-2 space-y-1">
			{#each [...editor.canvasState.elements].reverse() as el (el.id)}
				{@const isSelected = editor.isSelected(el.id)}
				<div
					draggable="true"
					role="listitem"
					ondragstart={(e) => handleLayerDragStart(e, el.id)}
					ondragover={(e) => handleLayerDragOver(e, el.id)}
					ondrop={(e) => handleLayerDrop(e, el.id)}
					ondragend={handleLayerDragEnd}
					class="group relative flex items-center gap-1.5 overflow-hidden rounded-lg border px-1.5 py-1 text-xs transition {dragOverLayerId ===
					el.id
						? 'border-accent bg-accent-soft'
						: isSelected
							? 'border-indigo-400 bg-indigo-50 text-indigo-950'
							: 'border-transparent hover:bg-surface-subtle'} {!el.visible ? 'opacity-50' : ''}"
				>
					<span class="shrink-0 cursor-grab text-slate-400 group-hover:text-slate-600" title="Drag to reorder">
						<GripVertical class="h-3.5 w-3.5" />
					</span>

					<button
						type="button"
						onclick={(e) => {
							editor.selectElement(el.id, {
								additive: Boolean(e.shiftKey || e.ctrlKey || e.metaKey)
							});
						}}
						ondblclick={() => {
							if (el.groupId) editor.selectElement(el.id, { ignoreGroup: true });
						}}
						class="flex min-h-7 min-w-0 flex-1 items-center gap-1.5 pr-1 text-left font-medium"
					>
						{#if el.type === 'placeholder' || el.type === 'title' || (el.type === 'text' && (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(el.text) || (el.rules?.length ?? 0) > 0))}
							<Tag class="h-3 w-3 shrink-0 text-indigo-500" />
						{:else if el.type === 'text'}
							<Type class="h-3 w-3 shrink-0 text-slate-500" />
						{:else if el.type === 'image'}
							<ImageIcon class="h-3 w-3 shrink-0 text-emerald-600" />
						{:else if el.type === 'signature'}
							<PenTool class="h-3 w-3 shrink-0 text-violet-600" />
						{:else if el.shapeKind === 'line'}
							<Minus class="h-3 w-3 shrink-0 text-amber-600" />
						{:else if el.shapeKind === 'circle'}
							<Circle class="h-3 w-3 shrink-0 text-amber-600" />
						{:else}
							<Square class="h-3 w-3 shrink-0 text-amber-600" />
						{/if}
						<span class="leading-snug break-words">{el.name}</span>
						{#if el.groupId}
							<span
								title="Grouped element (double-click to edit alone)"
								class="inline-flex shrink-0 items-center rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-700"
							>
								<Group class="h-2.5 w-2.5" />
							</span>
						{/if}
					</button>

					<!-- Actions take zero width at rest and slide out from the right on hover -->
					<div
						class="pointer-events-none absolute inset-y-0 right-0 flex translate-x-full items-center gap-0.5 bg-gradient-to-l pr-1 pl-5 opacity-0 transition-all duration-150 ease-out group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 focus-within:pointer-events-auto focus-within:translate-x-0 focus-within:opacity-100 {isSelected
							? 'from-indigo-50 via-indigo-50 to-transparent'
							: 'from-surface-subtle via-surface-subtle to-transparent'}"
					>
						<button
							type="button"
							title={el.visible ? 'Hide layer' : 'Show layer'}
							aria-label={el.visible ? 'Hide layer' : 'Show layer'}
							onclick={(e) => {
								e.stopPropagation();
								editor.updateElement(el.id, { visible: !el.visible });
							}}
							class="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-white hover:text-ink-primary"
						>
							{#if el.visible}
								<Eye class="h-3.5 w-3.5" />
							{:else}
								<EyeOff class="h-3.5 w-3.5" />
							{/if}
						</button>
						<button
							type="button"
							title={el.locked ? 'Unlock layer' : 'Lock layer'}
							aria-label={el.locked ? 'Unlock layer' : 'Lock layer'}
							onclick={(e) => {
								e.stopPropagation();
								editor.updateElement(el.id, { locked: !el.locked });
							}}
							class="flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-white hover:text-ink-primary"
						>
							{#if el.locked}
								<Lock class="h-3.5 w-3.5" />
							{:else}
								<Unlock class="h-3.5 w-3.5" />
							{/if}
						</button>
						<button
							type="button"
							title="Delete layer"
							aria-label="Delete layer"
							onclick={(e) => {
								e.stopPropagation();
								editor.deleteElement(el.id);
							}}
							class="flex h-6 w-6 items-center justify-center rounded text-red-500 hover:bg-red-50"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	</section>
</aside>

<ImageCropResizeModal
	bind:open={cropModalOpen}
	sourceUrl={pendingImageUrl}
	fileName={pendingImageName}
	mimeType={pendingImageMime}
	mode="image"
	canvasWidth={editor.width}
	canvasHeight={editor.height}
	onApply={handleApplyCroppedImage}
	onCancel={clearPendingImage}
/>
