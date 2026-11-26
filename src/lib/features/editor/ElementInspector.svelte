<script lang="ts">
	import {
		ArrowLeftRight,
		Copy,
		Crop,
		Group,
		ImagePlus,
		PenTool,
		Plus,
		Trash2,
		Ungroup,
		Upload,
		X
	} from '@lucide/svelte';
	import ImageCropResizeModal from '#lib/components/ui/ImageCropResizeModal.svelte';
	import { optimiseOriginalImageFile } from '#lib/components/ui/image-crop.ts';
	import ScrubNumberInput from '#lib/components/ui/ScrubNumberInput.svelte';
	import SignaturePad from '#lib/components/ui/SignaturePad.svelte';
	import { CANVAS_PRESETS } from '#lib/config/canvas.ts';
	import {
		STARTER_TEMPLATE_PRESETS,
		type StarterTemplatePreset
	} from '#lib/templates/starter.ts';
	import type {
		CriterionDefinition,
		ImageEditState,
		StaticTextCanvasElement,
		TitleBindingRule,
		TitleRuleCondition,
		TitleRuleOperator
	} from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import { ensureTemplateFontsLoaded } from './fonts.ts';
	import RichTextEditor from './RichTextEditor.svelte';
	import { stripRichTextMarkup } from './rich-text.ts';
	import { resolveElementText } from './text-utils.ts';

	interface Props {
		editor: EditorState;
		criteria: CriterionDefinition[];
		projectId: string;
		sampleData?: Record<string, string>;
		propertyValueOptions?: Record<string, string[]>;
	}

	let {
		editor,
		criteria,
		projectId,
		sampleData = {},
		propertyValueOptions = {}
	}: Props = $props();

	let customConditionMode = $state<Record<string, boolean>>({});
	const CUSTOM_VALUE_SENTINEL = '__custom_value__';

	function updateTextRules(nextRules: TitleBindingRule[]) {
		if (!selected || selected.type !== 'text') return;
		editor.updateElement(selected.id, { rules: nextRules });
	}

	function addTextRule() {
		if (!selected || selected.type !== 'text') return;
		const defaultKey = criteria.find((c) => c.key === 'role')?.key ?? criteria[0]?.key ?? 'role';
		const newRule: TitleBindingRule = {
			id: `rule-${Math.random().toString(36).slice(2, 8)}`,
			conditions: [{ propertyKey: defaultKey, operator: 'equals', value: '' }],
			output: ''
		};
		updateTextRules([...(selected.rules ?? []), newRule]);
	}

	function deleteTextRule(ruleId: string) {
		if (!selected || selected.type !== 'text') return;
		updateTextRules((selected.rules ?? []).filter((r) => r.id !== ruleId));
	}

	function updateRuleOutput(ruleId: string, output: string) {
		if (!selected || selected.type !== 'text') return;
		updateTextRules((selected.rules ?? []).map((r) => (r.id === ruleId ? { ...r, output } : r)));
	}

	function addConditionToRule(ruleId: string) {
		if (!selected || selected.type !== 'text') return;
		const rules = selected.rules ?? [];
		const rule = rules.find((r) => r.id === ruleId);
		if (!rule) return;
		const usedKeys = new Set(rule.conditions.map((c) => c.propertyKey));
		const nextKey =
			criteria.find((c) => !usedKeys.has(c.key))?.key ??
			criteria.find((c) => c.key === 'rank')?.key ??
			criteria[0]?.key ??
			'rank';
		const nextOp: TitleRuleOperator = nextKey === 'rank' || nextKey === 'ranking' ? 'not_empty' : 'equals';
		updateTextRules(
			rules.map((r) =>
				r.id === ruleId
					? {
							...r,
							conditions: [...r.conditions, { propertyKey: nextKey, operator: nextOp, value: '' }]
						}
					: r
			)
		);
	}

	function updateRuleCondition(
		ruleId: string,
		condIdx: number,
		patch: Partial<TitleRuleCondition>
	) {
		if (!selected || selected.type !== 'text') return;
		updateTextRules(
			(selected.rules ?? []).map((r) =>
				r.id === ruleId
					? {
							...r,
							conditions: r.conditions.map((c, idx) =>
								idx === condIdx ? { ...c, ...patch } : c
							)
						}
					: r
			)
		);
	}

	function removeRuleCondition(ruleId: string, condIdx: number) {
		if (!selected || selected.type !== 'text') return;
		updateTextRules(
			(selected.rules ?? []).map((r) =>
				r.id === ruleId
					? { ...r, conditions: r.conditions.filter((_, idx) => idx !== condIdx) }
					: r
			)
		);
	}

	const selected = $derived(editor.selectedElement);
	const activePresetId = $derived(
		CANVAS_PRESETS.find((p) => p.width === editor.width && p.height === editor.height)?.id ??
			'custom'
	);

	function applyCustomCanvasSize(nextW: number, nextH: number) {
		const w = Math.max(300, Math.min(5000, Math.round(nextW)));
		const h = Math.max(300, Math.min(5000, Math.round(nextH)));
		editor.setCanvasSize(w, h);
	}

	let bgInputEl = $state<HTMLInputElement | null>(null);
	let sigFileInputEl = $state<HTMLInputElement | null>(null);
	let imgReplaceInputEl = $state<HTMLInputElement | null>(null);
	let signatureTab = $state<'draw' | 'upload'>('draw');
	let uploadingBg = $state(false);
	let bgUploadError = $state('');
	let keepBackgroundImage = $state(false);
	let lastAppliedStarterId = $state<string | null>(null);

	const starterPreviews = STARTER_TEMPLATE_PRESETS.map((preset) => ({
		preset,
		state: preset.createState()
	}));

	function getThumbnailTextBar(el: StaticTextCanvasElement): {
		x: number;
		y: number;
		width: number;
		height: number;
		opacity: number;
	} {
		const barH = Math.max(14, Math.min(el.height * 0.65, el.fontSize * 0.72));
		const ratio =
			el.text.includes('{{name}}')
				? 0.62
				: el.text.includes('{{rank}}')
					? 0.72
					: el.text.includes('{{title}}')
						? 0.56
						: el.text.includes('{{role}}')
							? 0.36
							: 0.44;
		const barW = Math.max(64, Math.min(el.width, Math.round(el.width * ratio)));
		const x =
			el.align === 'left'
				? el.x
				: el.align === 'right'
					? el.x + el.width - barW
					: el.x + (el.width - barW) / 2;
		const y = el.y + (el.height - barH) / 2;
		return {
			x,
			y,
			width: barW,
			height: barH,
			opacity: el.fontSize >= 36 ? 0.92 : 0.68
		};
	}

	function handleApplyStarterTemplate(preset: StarterTemplatePreset) {
		const nextState = preset.createState(sampleData.title || 'Event Name Here');
		editor.applyStarterTemplate(
			{
				width: preset.width,
				height: preset.height,
				canvasState: nextState
			},
			{ preserveBackgroundImage: keepBackgroundImage }
		);
		lastAppliedStarterId = preset.id;
		void ensureTemplateFontsLoaded(nextState.elements);
	}

	let cropModalOpen = $state(false);
	let cropMode = $state<'background' | 'image'>('background');
	let cropSourceUrl = $state<string | null>(null);
	let cropOriginalFile = $state<File | null>(null);
	let cropInitialEditState = $state<ImageEditState | undefined>(undefined);
	let cropFileName = $state('background.png');
	let cropMimeType = $state('image/png');
	let cropTargetElementId = $state<string | null>(null);

	function clearCropSource() {
		if (cropSourceUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(cropSourceUrl);
		}
		cropSourceUrl = null;
		cropOriginalFile = null;
		cropInitialEditState = undefined;
		cropTargetElementId = null;
	}

	function handleBackgroundFileSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		clearCropSource();
		cropMode = 'background';
		cropOriginalFile = file;
		cropInitialEditState = undefined;
		cropSourceUrl = URL.createObjectURL(file);
		cropFileName = file.name;
		cropMimeType = file.type || 'image/png';
		cropTargetElementId = null;
		cropModalOpen = true;
		input.value = '';
	}

	function handleElementImageFileSelect(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !selected || (selected.type !== 'image' && selected.type !== 'signature')) return;
		clearCropSource();
		cropMode = 'image';
		cropOriginalFile = file;
		cropInitialEditState = undefined;
		cropSourceUrl = URL.createObjectURL(file);
		cropFileName = file.name;
		cropMimeType = file.type || 'image/png';
		cropTargetElementId = selected.id;
		cropModalOpen = true;
		input.value = '';
	}

	function openRecropBackground() {
		const bg = editor.canvasState.background;
		const url = bg.originalImageUrl || bg.imageUrl;
		if (!url) return;
		clearCropSource();
		cropMode = 'background';
		cropOriginalFile = null;
		cropInitialEditState = bg.editState;
		cropSourceUrl = url;
		cropFileName = 'certificate-background.png';
		cropMimeType = 'image/png';
		cropTargetElementId = null;
		cropModalOpen = true;
	}

	function openRecropSelectedImage() {
		if (!selected || (selected.type !== 'image' && selected.type !== 'signature')) return;
		const url = selected.originalSrc || selected.src;
		if (!url) return;
		clearCropSource();
		cropMode = 'image';
		cropOriginalFile = null;
		cropInitialEditState = selected.editState;
		cropSourceUrl = url;
		cropFileName = selected.name || 'image.png';
		cropMimeType = 'image/png';
		cropTargetElementId = selected.id;
		cropModalOpen = true;
	}

	async function postAssetFile(file: File, kind: 'image' | 'background') {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('kind', kind);
		formData.append('projectId', projectId);

		const res = await fetch('/api/assets', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.message ?? 'Image upload failed.');
		}
		const { asset } = await res.json();
		return asset as { id: string; publicUrl: string; fileName: string };
	}

	async function uploadElementAsset(
		targetId: string,
		file: File,
		naturalW: number,
		naturalH: number,
		options?: { originalFile?: File | null; editState?: ImageEditState; resetOriginal?: boolean }
	) {
		uploadingBg = true;
		bgUploadError = '';
		try {
			const [asset, origAsset] = await Promise.all([
				postAssetFile(file, 'image'),
				options?.originalFile ? postAssetFile(options.originalFile, 'image') : Promise.resolve(null)
			]);
			const targetEl = editor.canvasState.elements.find((el) => el.id === targetId);
			const existingOrigSrc =
				targetEl && (targetEl.type === 'image' || targetEl.type === 'signature')
					? targetEl.originalSrc || targetEl.src
					: undefined;
			const existingOrigAssetId =
				targetEl && (targetEl.type === 'image' || targetEl.type === 'signature')
					? targetEl.originalAssetId || targetEl.assetId
					: undefined;

			const nextOriginalSrc = options?.resetOriginal
				? asset.publicUrl
				: origAsset?.publicUrl ?? existingOrigSrc ?? asset.publicUrl;
			const nextOriginalAssetId = options?.resetOriginal
				? asset.id
				: origAsset?.id ?? existingOrigAssetId ?? asset.id;

			if (targetEl?.type === 'signature') {
				const maxW = Math.max(120, targetEl.width);
				const maxH = Math.max(60, targetEl.height);
				const scale = Math.min(maxW / naturalW, maxH / naturalH);
				editor.updateElement(targetId, {
					src: asset.publicUrl,
					assetId: asset.id,
					originalSrc: nextOriginalSrc,
					originalAssetId: nextOriginalAssetId,
					editState: options?.editState,
					width: Math.max(40, Math.round(naturalW * scale)),
					height: Math.max(24, Math.round(naturalH * scale))
				});
			} else {
				const maxW = 320;
				const maxH = 240;
				const scale = Math.min(1, maxW / naturalW, maxH / naturalH);
				editor.updateElement(targetId, {
					src: asset.publicUrl,
					assetId: asset.id,
					originalSrc: nextOriginalSrc,
					originalAssetId: nextOriginalAssetId,
					editState: options?.editState,
					width: Math.max(40, Math.round(naturalW * scale)),
					height: Math.max(40, Math.round(naturalH * scale))
				});
			}
		} catch (err) {
			bgUploadError = err instanceof Error ? err.message : 'Upload failed.';
		} finally {
			uploadingBg = false;
		}
	}

	async function handleSaveDrawnSignature(result: { file: File; width: number; height: number }) {
		if (!selected || selected.type !== 'signature') return;
		await uploadElementAsset(selected.id, result.file, result.width, result.height, {
			resetOriginal: true,
			editState: undefined
		});
	}

	async function handleApplyCroppedAsset(result: {
		file: File;
		width: number;
		height: number;
		editState: ImageEditState;
		isUnchangedFullFrame?: boolean;
	}) {
		const rawOrigFile = result.isUnchangedFullFrame ? null : cropOriginalFile;
		const origFile = rawOrigFile ? await optimiseOriginalImageFile(rawOrigFile) : null;
		if (cropMode === 'background') {
			uploadingBg = true;
			bgUploadError = '';
			try {
				const [asset, origAsset] = await Promise.all([
					postAssetFile(result.file, 'background'),
					origFile ? postAssetFile(origFile, 'background') : Promise.resolve(null)
				]);
				const currentBg = editor.canvasState.background;
				editor.setBackground({
					imageUrl: asset.publicUrl,
					assetId: asset.id,
					originalImageUrl:
						origAsset?.publicUrl ??
						(result.isUnchangedFullFrame
							? asset.publicUrl
							: currentBg.originalImageUrl ?? currentBg.imageUrl ?? asset.publicUrl),
					originalAssetId:
						origAsset?.id ??
						(result.isUnchangedFullFrame
							? asset.id
							: currentBg.originalAssetId ?? currentBg.assetId ?? asset.id),
					editState: result.editState
				});
			} catch (err) {
				bgUploadError = err instanceof Error ? err.message : 'Upload failed.';
			} finally {
				uploadingBg = false;
				clearCropSource();
			}
			return;
		}

		if (cropTargetElementId) {
			await uploadElementAsset(cropTargetElementId, result.file, result.width, result.height, {
				originalFile: origFile,
				editState: result.editState,
				resetOriginal: Boolean(result.isUnchangedFullFrame)
			});
		}
		clearCropSource();
	}
</script>

<aside
	class="flex h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-y-auto bg-surface-card p-3.5"
>
	{#if editor.selectedElements.length > 1}
		<div class="flex items-center justify-between border-b border-border-subtle pb-3">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-[0.07em] text-tone-editor-ink uppercase">
					{editor.isSingleGroupSelected ? 'Group' : 'Multi-Selection'}
				</p>
				<h2 class="font-display mt-0.5 text-sm font-semibold text-ink-primary tabular-nums">
					{editor.selectedElements.length} elements selected
				</h2>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<button
					type="button"
					title="Duplicate selected"
					aria-label="Duplicate selected"
					onclick={() => editor.duplicateElements(editor.selectedIds)}
					class="cf-pressable cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
				>
					<Copy class="h-4 w-4" />
				</button>
				<button
					type="button"
					title="Delete selected"
					aria-label="Delete selected"
					onclick={() => editor.deleteElements(editor.selectedIds)}
					class="cf-pressable cursor-pointer rounded-md p-1.5 text-tone-danger-ink hover:bg-tone-danger-soft"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Group / Ungroup Actions -->
		<div class="grid grid-cols-2 gap-1.5">
			<button
				type="button"
				disabled={!editor.canGroup}
				onclick={() => editor.groupSelected()}
				title="Group selected elements (Ctrl+G)"
				class="cf-pressable inline-flex h-[30px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-tone-editor-border bg-tone-editor-soft px-2.5 text-xs font-semibold text-tone-editor-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
			>
				<Group class="h-3.5 w-3.5" />
				Group
			</button>
			<button
				type="button"
				disabled={!editor.canUngroup}
				onclick={() => editor.ungroupSelected()}
				title="Ungroup selected elements (Ctrl+Shift+G)"
				class="cf-pressable inline-flex h-[30px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-2.5 text-xs font-semibold text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-45"
			>
				<Ungroup class="h-3.5 w-3.5" />
				Ungroup
			</button>
		</div>

		<p class="text-xs text-ink-muted">
			Hold <strong>Shift</strong> or <strong>Ctrl</strong> and click items to add or remove them, or
			drag across empty canvas. Double-click an item inside a group to edit it alone.
		</p>

		<section class="space-y-2 border-t border-border-subtle pt-3">
			<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
				Align Selection
			</h3>
			<div class="grid grid-cols-3 gap-1.5">
				{#each [
					{ id: 'left' as const, label: 'Left' },
					{ id: 'center-x' as const, label: 'Centre' },
					{ id: 'right' as const, label: 'Right' },
					{ id: 'top' as const, label: 'Top' },
					{ id: 'center-y' as const, label: 'Middle' },
					{ id: 'bottom' as const, label: 'Bottom' }
				] as act (act.id)}
					<button
						type="button"
						onclick={() => editor.alignSelectedElements(act.id)}
						class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
					>
						{act.label}
					</button>
				{/each}
			</div>
		</section>

		{#if editor.selectedElements.length >= 3}
			<section class="space-y-2 border-t border-border-subtle pt-3">
				<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
					Distribute Equally
				</h3>
				<div class="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						onclick={() => editor.alignSelectedElements('distribute-h')}
						class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
					>
						Space Horizontally
					</button>
					<button
						type="button"
						onclick={() => editor.alignSelectedElements('distribute-v')}
						class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
					>
						Space Vertically
					</button>
				</div>
			</section>
		{/if}

		<section class="space-y-2 border-t border-border-subtle pt-3">
			<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
				Centre Group on Canvas
			</h3>
			<div class="grid grid-cols-2 gap-1.5">
				<button
					type="button"
					onclick={() => editor.alignSelectedElements('canvas-center-x')}
					class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Centre Horizontally
				</button>
				<button
					type="button"
					onclick={() => editor.alignSelectedElements('canvas-center-y')}
					class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Centre Vertically
				</button>
			</div>
		</section>

		<section class="space-y-2 border-t border-border-subtle pt-3">
			<div class="flex items-center justify-between">
				<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
					Selected Items
				</h3>
				<button
					type="button"
					onclick={() => editor.clearSelection()}
					class="cursor-pointer text-[11px] font-medium text-accent-ink hover:underline"
				>
					Clear
				</button>
			</div>
			<div class="flex flex-wrap gap-1">
				{#each editor.selectedElements as item (item.id)}
					<span
						class="inline-flex items-center gap-1 rounded-md border border-tone-editor-border bg-tone-editor-soft px-2 py-0.5 text-xs font-medium text-tone-editor-ink"
					>
						<button
							type="button"
							title="Edit {item.name} alone"
							onclick={() => editor.selectElement(item.id, { ignoreGroup: true })}
							class="cursor-pointer hover:underline"
						>
							{item.name}
						</button>
						<button
							type="button"
							aria-label="Remove {item.name} from selection"
							onclick={() => editor.toggleSelect(item.id)}
							class="cursor-pointer rounded hover:opacity-75"
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		</section>
	{:else if !selected}
		<section class="space-y-4">
			<div>
				<h2 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
					Canvas Settings
				</h2>
				<p class="mt-1 text-xs text-ink-muted">
					Select any element on the certificate to edit its font, alignment and wrap rules.
				</p>
			</div>

			<div>
				<label for="canvas-preset" class="block text-xs font-medium text-ink-secondary">
					Page Size Preset
				</label>
				<select
					id="canvas-preset"
					value={activePresetId}
					onchange={(e) => {
						const preset = CANVAS_PRESETS.find((p) => p.id === e.currentTarget.value);
						if (preset) editor.setCanvasSize(preset.width, preset.height);
					}}
					class="mt-1 block h-[32px] w-full rounded-md border border-border-strong bg-surface-card px-2.5 text-xs text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
				>
					{#each CANVAS_PRESETS as preset (preset.id)}
						<option value={preset.id}>
							{preset.label} ({preset.width}×{preset.height})
						</option>
					{/each}
					{#if activePresetId === 'custom'}
						<option value="custom">Custom ({editor.width}×{editor.height})</option>
					{/if}
				</select>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-ink-secondary">Custom Size (px)</span>
					<button
						type="button"
						title="Swap width and height"
						aria-label="Swap width and height"
						onclick={() => applyCustomCanvasSize(editor.height, editor.width)}
						class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
					>
						<ArrowLeftRight class="h-3 w-3" />
						Swap
					</button>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<ScrubNumberInput
						id="canvas-width"
						label="Width"
						min={300}
						max={5000}
						step={1}
						pixelsPerStep={2}
						value={editor.width}
						onValueChange={(next) => applyCustomCanvasSize(next, editor.height)}
					/>
					<ScrubNumberInput
						id="canvas-height"
						label="Height"
						min={300}
						max={5000}
						step={1}
						pixelsPerStep={2}
						value={editor.height}
						onValueChange={(next) => applyCustomCanvasSize(editor.width, next)}
					/>
				</div>
				<p class="text-[11px] text-ink-muted">
					Enter or drag any size from 300 to 5000 px.
				</p>
			</div>
		</section>

		<section class="space-y-4 border-t border-border-subtle pt-4">
			<h2 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
				Certificate Settings
			</h2>

			<div>
				<label for="bg-color" class="block text-xs font-medium text-ink-secondary">
					Background Colour
				</label>
				<div class="mt-1 flex items-center gap-2">
					<input
						id="bg-color"
						type="color"
						value={editor.canvasState.background.color}
						oninput={(e) => editor.setBackground({ color: e.currentTarget.value })}
						class="h-[30px] w-10 cursor-pointer rounded-md border border-border-strong bg-transparent"
					/>
					<input
						type="text"
						aria-label="Background colour hex"
						value={editor.canvasState.background.color}
						onchange={(e) => editor.setBackground({ color: e.currentTarget.value })}
						class="h-[30px] w-full rounded-md border border-border-strong bg-surface-card px-2.5 font-mono text-xs text-ink-primary uppercase outline-none focus:border-accent-vivid dark:bg-surface-recessed"
					/>
				</div>
			</div>

			<div class="space-y-2">
				<input
					bind:this={bgInputEl}
					type="file"
					accept="image/*"
					onchange={handleBackgroundFileSelect}
					class="hidden"
				/>
				<button
					type="button"
					disabled={uploadingBg}
					onclick={() => bgInputEl?.click()}
					class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-2.5 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle disabled:opacity-45"
				>
					<ImagePlus class="h-3.5 w-3.5" />
					{uploadingBg ? 'Uploading...' : 'Upload Background'}
				</button>

				{#if bgUploadError}
					<p class="text-[11px] text-tone-danger-ink">{bgUploadError}</p>
				{/if}

				{#if editor.canvasState.background.imageUrl}
					<button
						type="button"
						disabled={uploadingBg}
						onclick={openRecropBackground}
						class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 text-xs font-medium text-ink-primary hover:bg-surface-subtle disabled:opacity-45"
					>
						<Crop class="h-3.5 w-3.5" />
						Crop & Resize Background
					</button>
					<button
						type="button"
						onclick={() =>
							editor.setBackground({
								imageUrl: undefined,
								assetId: undefined,
								originalImageUrl: undefined,
								originalAssetId: undefined,
								editState: undefined
							})}
						class="cf-pressable w-full cursor-pointer rounded-md border border-tone-danger-border bg-tone-danger-soft px-3 py-1.5 text-xs font-medium text-tone-danger-ink hover:opacity-90"
					>
						Remove Background Image
					</button>
				{/if}
			</div>
		</section>

		<section class="space-y-3 border-t border-border-subtle pt-4">
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
					Starter Templates
				</h2>
				{#if lastAppliedStarterId && editor.canUndo}
					<button
						type="button"
						onclick={() => {
							editor.undo();
							lastAppliedStarterId = null;
						}}
						class="cursor-pointer text-[11px] font-medium text-accent-ink hover:underline"
					>
						Undo
					</button>
				{/if}
			</div>

			<p class="text-[11px] leading-relaxed text-ink-muted">
				Select a layout to replace the canvas. Press <kbd class="rounded-[4px] border border-border-default bg-surface-subtle px-1 py-0.5 font-mono text-[10px]">Ctrl+Z</kbd> to undo.
			</p>

			{#if editor.canvasState.background.imageUrl}
				<label class="flex cursor-pointer items-center gap-2 text-[11px] text-ink-secondary">
					<input
						type="checkbox"
						bind:checked={keepBackgroundImage}
						class="h-3.5 w-3.5 rounded-[4px] border-border-strong accent-accent"
					/>
					<span>Keep current background image</span>
				</label>
			{/if}

			<div class="grid grid-cols-2 gap-2">
				{#each starterPreviews as { preset, state } (preset.id)}
					<button
						type="button"
						onclick={() => handleApplyStarterTemplate(preset)}
						title="Apply {preset.name} ({preset.width}×{preset.height})"
						class="cf-card-lift group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-surface-card text-left {lastAppliedStarterId ===
						preset.id
							? 'border-2 border-tone-editor'
							: 'border-border-default'}"
					>
						<div class="editor-sandbox-grid flex h-20 w-full items-center justify-center p-1.5">
							<svg
								viewBox="0 0 {preset.width} {preset.height}"
								aria-hidden="true"
								class="preserve-light max-h-full max-w-full rounded-[2px]"
							>
								<rect
									x="0"
									y="0"
									width={preset.width}
									height={preset.height}
									fill={state.background.color}
								/>
								{#each state.elements as el (el.id)}
									{#if el.type === 'shape'}
										{#if el.shapeKind === 'rect'}
											<rect
												x={el.x}
												y={el.y}
												width={el.width}
												height={el.height}
												rx={el.cornerRadius ?? 0}
												fill={el.fill === 'transparent' ? 'none' : el.fill}
												stroke={el.stroke === 'transparent' ? 'none' : el.stroke}
												stroke-width={el.strokeWidth > 0 ? Math.max(8, el.strokeWidth * 2.5) : 0}
											/>
										{:else if el.shapeKind === 'circle'}
											<ellipse
												cx={el.x + el.width / 2}
												cy={el.y + el.height / 2}
												rx={el.width / 2}
												ry={el.height / 2}
												fill={el.fill === 'transparent' ? 'none' : el.fill}
												stroke={el.stroke === 'transparent' ? 'none' : el.stroke}
												stroke-width={el.strokeWidth > 0 ? Math.max(8, el.strokeWidth * 2.5) : 0}
											/>
										{:else if el.shapeKind === 'line'}
											<line
												x1={el.x}
												y1={el.y}
												x2={el.x + el.width}
												y2={el.y}
												stroke={el.stroke}
												stroke-width={Math.max(8, el.strokeWidth * 3)}
												stroke-linecap="round"
											/>
										{/if}
									{:else if el.type === 'text'}
										{@const bar = getThumbnailTextBar(el)}
										<rect
											x={bar.x}
											y={bar.y}
											width={bar.width}
											height={bar.height}
											rx={bar.height / 2}
											fill={el.fill}
											opacity={bar.opacity}
										/>
									{/if}
								{/each}
							</svg>
						</div>
						<div class="border-t border-border-subtle px-2 py-1.5">
							<p class="truncate text-[11px] font-semibold text-ink-primary group-hover:text-tone-editor-ink">
								{preset.name}
							</p>
							<p class="truncate text-[10px] text-ink-muted">
								{preset.styleTag}
							</p>
						</div>
					</button>
				{/each}
			</div>
		</section>
	{:else}
		<div class="flex items-center justify-between border-b border-border-subtle pb-3">
			<div class="min-w-0">
				<p class="text-[11px] font-semibold tracking-[0.07em] text-tone-editor-ink uppercase">
					{selected.type}
				</p>
				<input
					type="text"
					aria-label="Element name"
					value={selected.name}
					onchange={(e) => editor.updateElement(selected.id, { name: e.currentTarget.value })}
					class="mt-0.5 w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-ink-primary hover:border-border-default focus:border-accent-vivid focus:outline-none"
				/>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<button
					type="button"
					title="Duplicate"
					onclick={() => editor.duplicateElement(selected.id)}
					class="cf-pressable cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
				>
					<Copy class="h-4 w-4" />
				</button>
				<button
					type="button"
					title="Delete"
					onclick={() => editor.deleteElement(selected.id)}
					class="cf-pressable cursor-pointer rounded-md p-1.5 text-tone-danger-ink hover:bg-tone-danger-soft"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			</div>
		</div>

		{#if selected.groupId}
			{@const gid = selected.groupId}
			<div
				class="flex items-center justify-between gap-2 rounded-lg border border-tone-editor-border bg-tone-editor-soft px-2.5 py-2 text-xs"
			>
				<span class="inline-flex items-center gap-1.5 font-medium text-tone-editor-ink">
					<Group class="h-3.5 w-3.5" />
					Part of a group
				</span>
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={() => editor.selectGroupById(gid)}
						class="cursor-pointer rounded bg-surface-card px-2 py-0.5 text-[11px] font-semibold text-tone-editor-ink shadow-xs hover:bg-surface-subtle"
					>
						Select Group
					</button>
					<button
						type="button"
						onclick={() => editor.ungroupSelected()}
						class="cursor-pointer rounded bg-surface-card px-2 py-0.5 text-[11px] font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle"
					>
						Ungroup
					</button>
				</div>
			</div>
		{/if}

		<!-- Text Content -->
		{#if selected.type === 'text'}
			{@const textRules = selected.rules ?? []}
			{@const elementBaseStyle = {
				fontFamily: selected.fontFamily,
				fontSize: selected.fontSize,
				fontWeight: selected.fontWeight,
				fontStyle: selected.fontStyle,
				underline: selected.textDecoration === 'underline',
				fill: selected.fill
			}}
			<section class="space-y-3">
				<div class="space-y-2">
					<label for="el-text-content" class="block text-xs font-medium text-ink-secondary">
						Text Content (double-click canvas or highlight words here for the top toolbar)
					</label>

					<RichTextEditor
						id="el-text-content"
						value={selected.text}
						{editor}
						elementId={selected.id}
						fieldLabel="Text Content"
						baseStyle={elementBaseStyle}
						rows={3}
						{criteria}
						onChange={(nextText) => editor.updateElement(selected.id, { text: nextText })}
					/>
				</div>

				{#if /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(selected.text)}
					<div class="rounded-xl border border-tone-editor-border bg-tone-editor-soft/50 p-3">
						<label for="el-default-value" class="block text-xs font-medium text-ink-secondary">
							Default Value (when empty)
						</label>
						<input
							id="el-default-value"
							type="text"
							value={selected.fallbackText ?? ''}
							oninput={(e) =>
								editor.updateElement(selected.id, { fallbackText: e.currentTarget.value })}
							placeholder="e.g. Certificate of Participation"
							class="mt-1 block h-[30px] w-full rounded-md border border-border-strong bg-surface-card px-2.5 text-xs text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
						/>
						<p class="mt-1 text-[11px] text-ink-muted">
							Used when a recipient has an empty value for this placeholder.
						</p>
					</div>
				{/if}

				<!-- Conditional Binding Rules -->
				<div class="space-y-2.5 rounded-xl border border-tone-certs-border bg-tone-certs-soft/55 p-3">
					<div class="flex items-center justify-between gap-2">
						<span class="text-[11px] font-semibold tracking-[0.07em] text-tone-certs-ink uppercase">
							Conditional Rules {textRules.length > 0 ? `(${textRules.length})` : ''}
						</span>
						<button
							type="button"
							onclick={addTextRule}
							class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-tone-certs-border bg-surface-card px-2 py-1 text-[11px] font-semibold text-tone-certs-ink shadow-xs hover:bg-surface-subtle"
						>
							<Plus class="h-3 w-3" />
							Add Rule
						</button>
					</div>

					{#if textRules.length === 0}
						<p class="text-[11px] text-ink-muted">
							Optional: override this text when a recipient matches specific properties. Most
							specific rule wins.
						</p>
					{:else}
						<div class="space-y-2">
							{#each textRules as rule, ruleIdx (rule.id)}
								<div class="space-y-2 rounded-lg border border-border-default bg-surface-card p-2.5 shadow-xs">
									<div class="flex items-center justify-between">
										<span class="text-[10px] font-semibold tracking-[0.07em] text-tone-editor-ink uppercase">
											Rule {ruleIdx + 1} · When
										</span>
										<button
											type="button"
											title="Delete rule"
											aria-label="Delete rule {ruleIdx + 1}"
											onclick={() => deleteTextRule(rule.id)}
											class="cursor-pointer rounded p-1 text-tone-danger-ink hover:bg-tone-danger-soft"
										>
											<Trash2 class="h-3 w-3" />
										</button>
									</div>

									<div class="space-y-1.5">
										{#each rule.conditions as cond, condIdx (condIdx)}
											{@const condFieldKey = `${rule.id}-${condIdx}`}
											{@const options = propertyValueOptions[cond.propertyKey] ?? []}
											{@const matchedOption = options.find(
												(opt) => opt.toLowerCase() === cond.value.trim().toLowerCase()
											)}
											{@const showCustomInput =
												options.length === 0 ||
												Boolean(customConditionMode[condFieldKey]) ||
												(cond.value.trim() !== '' && !matchedOption)}
											<div class="space-y-1 rounded-md bg-surface-page p-1.5">
												{#if condIdx > 0}
													<span class="block text-[10px] font-semibold text-ink-muted uppercase">
														And
													</span>
												{/if}
												<div class="flex items-center gap-1">
													<select
														aria-label="Rule {ruleIdx + 1} condition {condIdx + 1} property"
														value={cond.propertyKey}
														onchange={(e) => {
															const nextProp = e.currentTarget.value;
															customConditionMode[condFieldKey] = false;
															updateRuleCondition(rule.id, condIdx, {
																propertyKey: nextProp,
																value: ''
															});
														}}
														class="min-w-0 flex-1 rounded border border-border-strong bg-surface-card px-1.5 py-1 text-[11px] text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
													>
														{#each criteria as prop (prop.key)}
															<option value={prop.key}>{prop.label}</option>
														{/each}
													</select>

													<select
														aria-label="Rule {ruleIdx + 1} condition {condIdx + 1} operator"
														value={cond.operator}
														onchange={(e) =>
															updateRuleCondition(rule.id, condIdx, {
																operator: e.currentTarget.value as TitleRuleOperator
															})}
														class="rounded border border-border-strong bg-surface-card px-1.5 py-1 text-[11px] text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
													>
														<option value="equals">is</option>
														<option value="not_empty">has value</option>
														<option value="is_empty">is empty</option>
													</select>

													{#if rule.conditions.length > 1}
														<button
															type="button"
															aria-label="Remove condition"
															onclick={() => removeRuleCondition(rule.id, condIdx)}
															class="cursor-pointer rounded p-0.5 text-ink-muted hover:bg-tone-danger-soft hover:text-tone-danger-ink"
														>
															<X class="h-3 w-3" />
														</button>
													{/if}
												</div>

												{#if cond.operator === 'equals'}
													{#if options.length > 0}
														<select
															aria-label="Rule {ruleIdx + 1} condition {condIdx + 1} existing value"
															value={showCustomInput
																? CUSTOM_VALUE_SENTINEL
																: (matchedOption ?? '')}
															onchange={(e) => {
																const chosen = e.currentTarget.value;
																if (chosen === CUSTOM_VALUE_SENTINEL) {
																	customConditionMode[condFieldKey] = true;
																	return;
																}
																customConditionMode[condFieldKey] = false;
																updateRuleCondition(rule.id, condIdx, { value: chosen });
															}}
															class="block w-full rounded border border-border-strong bg-surface-card px-2 py-1 text-[11px] text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
														>
															<option value="">Select existing value...</option>
															{#each options as opt (opt)}
																<option value={opt}>{opt}</option>
															{/each}
															<option value={CUSTOM_VALUE_SENTINEL}>Type custom value...</option>
														</select>
													{/if}

													{#if showCustomInput}
														<input
															type="text"
															aria-label="Rule {ruleIdx + 1} condition {condIdx + 1} value"
															value={cond.value}
															oninput={(e) =>
																updateRuleCondition(rule.id, condIdx, {
																	value: e.currentTarget.value
																})}
															placeholder="Type custom value..."
															class="block w-full rounded border border-border-strong bg-surface-card px-2 py-1 text-[11px] text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
														/>
													{/if}
												{/if}
											</div>
										{/each}
									</div>

									<button
										type="button"
										onclick={() => addConditionToRule(rule.id)}
										class="cursor-pointer text-[11px] font-medium text-tone-editor-ink hover:underline"
									>
										+ And Condition
									</button>

									<div class="space-y-1.5 border-t border-border-subtle pt-2">
										<label
											for="rule-out-{rule.id}"
											class="block text-[10px] font-semibold tracking-[0.07em] text-ink-muted uppercase"
										>
											Show Text
										</label>
										<RichTextEditor
											id="rule-out-{rule.id}"
											value={rule.output}
											{editor}
											elementId={selected.id}
											fieldLabel="Rule {ruleIdx + 1}"
											baseStyle={elementBaseStyle}
											rows={3}
											compact
											{criteria}
											placeholder={'e.g. for winning {{rank}}\nat {{title}}'}
											onChange={(nextOutput) => updateRuleOutput(rule.id, nextOutput)}
										/>
									</div>
								</div>
							{/each}
						</div>

						<div class="rounded-lg border border-tone-certs-border bg-surface-card px-2.5 py-1.5 text-[11px]">
							<span class="text-ink-muted">Current preview output:</span>
							<span class="mt-0.5 block font-semibold whitespace-pre-wrap text-ink-primary">
								{stripRichTextMarkup(resolveElementText(selected, sampleData, 'sample'))}
							</span>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Image Crop, Resize & Replace -->
		{#if selected.type === 'image'}
			<section class="space-y-2 border-t border-border-subtle pt-3">
				<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">Image</h3>
				<input
					bind:this={imgReplaceInputEl}
					type="file"
					accept="image/*"
					onchange={handleElementImageFileSelect}
					class="hidden"
				/>
				<button
					type="button"
					disabled={uploadingBg}
					onclick={openRecropSelectedImage}
					class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-3 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle disabled:opacity-45"
				>
					<Crop class="h-3.5 w-3.5" />
					{uploadingBg ? 'Uploading...' : 'Crop & Resize Image'}
				</button>
				<button
					type="button"
					disabled={uploadingBg}
					onclick={() => imgReplaceInputEl?.click()}
					class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary disabled:opacity-45"
				>
					<Upload class="h-3.5 w-3.5" />
					Replace Image
				</button>
				{#if bgUploadError}
					<p class="text-[11px] text-tone-danger-ink">{bgUploadError}</p>
				{/if}
			</section>
		{/if}

		<!-- Signature Editor -->
		{#if selected.type === 'signature'}
			<section class="space-y-3 border-t border-border-subtle pt-3">
				<div class="flex items-center justify-between">
					<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
						Signature
					</h3>
					{#if selected.src}
						<span
							class="rounded-full border border-tone-data-border bg-tone-data-soft px-2 py-0.5 text-[10px] font-medium text-tone-data-ink"
						>
							Ready
						</span>
					{/if}
				</div>

				<!-- Draw / Upload mode segmented pill -->
				<div
					class="grid grid-cols-2 rounded-[10px] border border-border-default bg-surface-subtle p-[3px] dark:bg-surface-recessed"
				>
					<button
						type="button"
						onclick={() => (signatureTab = 'draw')}
						class="cf-glide-thumb inline-flex min-h-7 cursor-pointer items-center justify-center gap-1 rounded-[7px] text-xs transition {signatureTab ===
						'draw'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<PenTool class="h-3.5 w-3.5" />
						Draw
					</button>
					<button
						type="button"
						onclick={() => (signatureTab = 'upload')}
						class="cf-glide-thumb inline-flex min-h-7 cursor-pointer items-center justify-center gap-1 rounded-[7px] text-xs transition {signatureTab ===
						'upload'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<Upload class="h-3.5 w-3.5" />
						Upload
					</button>
				</div>

				{#if signatureTab === 'draw'}
					<SignaturePad saving={uploadingBg} onSaveDrawing={handleSaveDrawnSignature} />
				{:else}
					<div class="space-y-2">
						<input
							bind:this={sigFileInputEl}
							type="file"
							accept="image/*"
							onchange={handleElementImageFileSelect}
							class="hidden"
						/>
						<button
							type="button"
							disabled={uploadingBg}
							onclick={() => sigFileInputEl?.click()}
							class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-3 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle disabled:opacity-45"
						>
							<Upload class="h-3.5 w-3.5" />
							{uploadingBg ? 'Uploading...' : 'Upload Signature Image'}
						</button>

						{#if selected.src}
							<button
								type="button"
								disabled={uploadingBg}
								onclick={openRecropSelectedImage}
								class="cf-pressable flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary disabled:opacity-45"
							>
								<Crop class="h-3.5 w-3.5" />
								Crop & Resize Signature
							</button>
						{/if}
					</div>
				{/if}

				{#if selected.src}
					<button
						type="button"
						onclick={() =>
							editor.updateElement(selected.id, {
								src: '',
								assetId: undefined,
								originalSrc: undefined,
								originalAssetId: undefined,
								editState: undefined
							})}
						class="cf-pressable w-full cursor-pointer rounded-md border border-tone-danger-border bg-tone-danger-soft px-3 py-1.5 text-xs font-medium text-tone-danger-ink hover:opacity-90"
					>
						Clear Signature
					</button>
				{/if}

				{#if bgUploadError}
					<p class="text-[11px] text-tone-danger-ink">{bgUploadError}</p>
				{/if}
			</section>
		{/if}

		<!-- Shape / Line Styling -->
		{#if selected.type === 'shape'}
			{@const isLine = selected.shapeKind === 'line'}
			<section class="space-y-3 border-t border-border-subtle pt-3">
				<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
					{isLine ? 'Line Style' : 'Shape Style'}
				</h3>
				<div class="grid grid-cols-2 gap-2">
					<div>
						<label for="shp-stroke" class="block text-xs font-medium text-ink-secondary">
							{isLine ? 'Line Colour' : 'Stroke Colour'}
						</label>
						<input
							id="shp-stroke"
							type="color"
							value={selected.stroke}
							oninput={(e) => editor.updateElement(selected.id, { stroke: e.currentTarget.value })}
							class="mt-1 h-[30px] w-full cursor-pointer rounded-md border border-border-strong bg-transparent"
						/>
					</div>
					<ScrubNumberInput
						id="shp-width"
						label={isLine ? 'Thickness' : 'Stroke Width'}
						min={isLine ? 1 : 0}
						max={40}
						step={1}
						pixelsPerStep={4}
						value={selected.strokeWidth}
						onScrubStart={() => editor.pushHistorySnapshot()}
						onValueChange={(next, { scrubbing }) =>
							editor.updateElement(selected.id, { strokeWidth: next }, !scrubbing)}
					/>
				</div>
			</section>
		{/if}

		<!-- Canvas Alignment & Box Geometry -->
		<section class="space-y-3 border-t border-border-subtle pt-3">
			<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
				{selected.type === 'shape' && selected.shapeKind === 'line'
					? 'Position & Length'
					: 'Transform'}
			</h3>
			<div class="grid grid-cols-2 gap-1.5">
				<button
					type="button"
					onclick={() => editor.alignElementOnCanvas(selected.id, 'center-x')}
					class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Centre Horizontally
				</button>
				<button
					type="button"
					onclick={() => editor.alignElementOnCanvas(selected.id, 'center-y')}
					class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-card px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
				>
					Centre Vertically
				</button>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<ScrubNumberInput
					id="el-pos-x"
					label="X"
					step={1}
					pixelsPerStep={1}
					value={selected.x}
					onScrubStart={() => editor.pushHistorySnapshot()}
					onValueChange={(next, { scrubbing }) =>
						editor.updateElement(selected.id, { x: next }, !scrubbing)}
				/>
				<ScrubNumberInput
					id="el-pos-y"
					label="Y"
					step={1}
					pixelsPerStep={1}
					value={selected.y}
					onScrubStart={() => editor.pushHistorySnapshot()}
					onValueChange={(next, { scrubbing }) =>
						editor.updateElement(selected.id, { y: next }, !scrubbing)}
				/>
				{#if selected.type === 'shape' && selected.shapeKind === 'line'}
					<ScrubNumberInput
						id="el-dim-w"
						label="Length"
						min={16}
						step={1}
						pixelsPerStep={1}
						value={selected.width}
						onScrubStart={() => editor.pushHistorySnapshot()}
						onValueChange={(next, { scrubbing }) =>
							editor.updateElement(selected.id, { width: next }, !scrubbing)}
					/>
					<ScrubNumberInput
						id="el-dim-rot"
						label="Angle (°)"
						min={-360}
						max={360}
						step={1}
						pixelsPerStep={2}
						value={selected.rotation}
						onScrubStart={() => editor.pushHistorySnapshot()}
						onValueChange={(next, { scrubbing }) =>
							editor.updateElement(selected.id, { rotation: next }, !scrubbing)}
					/>
				{:else}
					<ScrubNumberInput
						id="el-dim-w"
						label="Width"
						min={16}
						step={1}
						pixelsPerStep={1}
						value={selected.width}
						onScrubStart={() => editor.pushHistorySnapshot()}
						onValueChange={(next, { scrubbing }) =>
							editor.updateElement(selected.id, { width: next }, !scrubbing)}
					/>
					<ScrubNumberInput
						id="el-dim-h"
						label="Height"
						min={12}
						step={1}
						pixelsPerStep={1}
						value={selected.height}
						onScrubStart={() => editor.pushHistorySnapshot()}
						onValueChange={(next, { scrubbing }) =>
							editor.updateElement(selected.id, { height: next }, !scrubbing)}
					/>
				{/if}
			</div>
		</section>
	{/if}
</aside>

<ImageCropResizeModal
	bind:open={cropModalOpen}
	sourceUrl={cropSourceUrl}
	fileName={cropFileName}
	mimeType={cropMimeType}
	mode={cropMode}
	canvasWidth={editor.width}
	canvasHeight={editor.height}
	initialEditState={cropInitialEditState}
	onApply={handleApplyCroppedAsset}
	onCancel={clearCropSource}
/>
