import type {
	CanvasElement,
	CriterionDefinition,
	ImageEditState,
	ShapeCanvasElement,
	StaticTextCanvasElement,
	TemplateBackground,
	TemplateCanvasState
} from '#lib/types/certflow.ts';
import type { InlineFormatAction, RichTextStyle } from './rich-text.ts';

export interface ActiveTextSelection {
	elementId: string;
	fieldId: string;
	label: string;
	text: string;
	start: number;
	end: number;
	selectedText: string;
	effectiveStyle?: RichTextStyle;
	apply: (action: InlineFormatAction, options?: { restoreFocus?: boolean }) => void;
	clear: () => void;
}

function cloneState(state: TemplateCanvasState): TemplateCanvasState {
	// Unwrap Svelte 5 $state proxies before cloning so structuredClone never throws DataCloneError.
	return structuredClone($state.snapshot(state));
}

function makeId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

interface EditorHistoryEntry {
	width: number;
	height: number;
	canvasState: TemplateCanvasState;
}

/**
 * Reactive Svelte 5 document store for the interactive Konva certificate editor.
 * Keeps undo/redo history, active selection and canvas state decoupled from Konva DOM nodes.
 */
export class EditorState {
	width = $state(1123);
	height = $state(794);
	canvasState = $state<TemplateCanvasState>({
		version: 1,
		background: { color: '#ffffff' },
		elements: []
	});
	selectedIds = $state<string[]>([]);
	activeTextSelection = $state<ActiveTextSelection | null>(null);
	zoom = $state(0.72);
	autoFitZoom = $state(true);
	previewMode = $state<'placeholders' | 'sample'>('sample');
	dirty = $state(false);

	private past: EditorHistoryEntry[] = $state([]);
	private future: EditorHistoryEntry[] = $state([]);
	private clipboard: CanvasElement[] = $state([]);
	private pasteOffsetStep = $state(0);

	get selectedId(): string | null {
		return this.selectedIds.length === 1 ? this.selectedIds[0] : null;
	}

	set selectedId(id: string | null) {
		this.selectedIds = id ? [id] : [];
	}

	selectedElements = $derived<CanvasElement[]>(
		this.canvasState.elements.filter((el) => this.selectedIds.includes(el.id))
	);

	selectedElement = $derived<CanvasElement | null>(
		this.selectedElements.length === 1 ? this.selectedElements[0] : null
	);

	canUndo = $derived(this.past.length > 0);
	canRedo = $derived(this.future.length > 0);
	hasClipboard = $derived(this.clipboard.length > 0);

	isSingleGroupSelected = $derived.by(() => {
		const els = this.selectedElements;
		if (els.length < 2) return false;
		const firstGroupId = els[0].groupId;
		if (!firstGroupId) return false;
		if (!els.every((el) => el.groupId === firstGroupId)) return false;
		const fullGroupCount = this.canvasState.elements.filter((el) => el.groupId === firstGroupId).length;
		return els.length === fullGroupCount;
	});

	canGroup = $derived(
		this.selectedElements.filter((el) => !el.locked).length >= 2 && !this.isSingleGroupSelected
	);

	canUngroup = $derived(this.selectedElements.some((el) => Boolean(el.groupId)));

	private expandIdsWithGroups(ids: string[]): string[] {
		const validIds = new Set(this.canvasState.elements.map((el) => el.id));
		const groupIds = new Set<string>();
		const result = new Set<string>();

		for (const id of ids) {
			if (!validIds.has(id)) continue;
			const el = this.canvasState.elements.find((item) => item.id === id);
			if (!el) continue;
			result.add(el.id);
			if (el.groupId) groupIds.add(el.groupId);
		}

		if (groupIds.size > 0) {
			for (const el of this.canvasState.elements) {
				if (el.groupId && groupIds.has(el.groupId) && el.visible) {
					result.add(el.id);
				}
			}
		}

		return Array.from(result);
	}

	isSelected(id: string): boolean {
		return this.selectedIds.includes(id);
	}

	selectOnly(id: string | null) {
		if (!id || this.activeTextSelection?.elementId !== id) {
			this.activeTextSelection = null;
		}
		this.selectedIds = id ? [id] : [];
	}

	selectGroupById(groupId: string) {
		this.activeTextSelection = null;
		const memberIds = this.canvasState.elements
			.filter((el) => el.groupId === groupId && el.visible)
			.map((el) => el.id);
		this.selectedIds = memberIds;
	}

	selectElement(id: string, options?: { additive?: boolean; ignoreGroup?: boolean }) {
		if (this.activeTextSelection?.elementId !== id) {
			this.activeTextSelection = null;
		}
		const target = this.canvasState.elements.find((el) => el.id === id);
		if (!target) return;

		const memberIds =
			!options?.ignoreGroup && target.groupId
				? this.canvasState.elements
						.filter((el) => el.groupId === target.groupId && el.visible)
						.map((el) => el.id)
				: [target.id];

		if (options?.additive) {
			const allAlreadySelected = memberIds.every((mid) => this.selectedIds.includes(mid));
			if (allAlreadySelected) {
				const removeSet = new Set(memberIds);
				this.selectedIds = this.selectedIds.filter((item) => !removeSet.has(item));
			} else {
				this.selectedIds = Array.from(new Set([...this.selectedIds, ...memberIds]));
			}
			return;
		}

		this.selectedIds = memberIds;
	}

	toggleSelect(id: string) {
		this.activeTextSelection = null;
		if (this.selectedIds.includes(id)) {
			this.selectedIds = this.selectedIds.filter((item) => item !== id);
		} else {
			this.selectedIds = [...this.selectedIds, id];
		}
	}

	selectMultiple(ids: string[]) {
		this.activeTextSelection = null;
		this.selectedIds = this.expandIdsWithGroups(ids);
	}

	clearSelection() {
		this.activeTextSelection = null;
		this.selectedIds = [];
	}

	setActiveTextSelection(next: ActiveTextSelection | null) {
		this.activeTextSelection = next;
	}

	clearActiveTextSelection(fieldId?: string) {
		if (!fieldId || this.activeTextSelection?.fieldId === fieldId) {
			this.activeTextSelection = null;
		}
	}

	groupSelected() {
		const targets = this.selectedElements.filter((el) => !el.locked);
		if (targets.length < 2) return;
		const groupId = makeId('grp');
		const idSet = new Set(targets.map((el) => el.id));
		this.commit((draft) => {
			for (let i = 0; i < draft.elements.length; i++) {
				if (idSet.has(draft.elements[i].id)) {
					draft.elements[i] = { ...draft.elements[i], groupId };
				}
			}
		});
		this.selectedIds = targets.map((el) => el.id);
	}

	ungroupSelected() {
		const groupIds = new Set(
			this.selectedElements.map((el) => el.groupId).filter((gid): gid is string => Boolean(gid))
		);
		if (groupIds.size === 0) return;
		this.commit((draft) => {
			for (let i = 0; i < draft.elements.length; i++) {
				const el = draft.elements[i];
				if (el.groupId && groupIds.has(el.groupId)) {
					const copy = { ...el };
					delete copy.groupId;
					draft.elements[i] = copy;
				}
			}
		});
	}

	loadTemplate(input: { width: number; height: number; canvasState: TemplateCanvasState }) {
		this.width = input.width;
		this.height = input.height;
		const cloned = cloneState(input.canvasState);
		// Upgrade legacy placeholder and title elements into unified rule-capable text elements.
		cloned.elements = cloned.elements.map((el) => {
			if (el.type === 'placeholder') {
				const { type: _type, criterionKey, ...rest } = el;
				const tokenKey = criterionKey === 'ranking' ? 'rank' : criterionKey;
				return {
					...rest,
					type: 'text',
					text: `{{${tokenKey}}}`
				};
			}
			if (el.type === 'title') {
				const { type: _type, defaultTitle, rules, ...rest } = el;
				return {
					...rest,
					type: 'text',
					text: defaultTitle,
					rules
				};
			}
			return el;
		});
		this.canvasState = cloned;
		this.selectedIds = [];
		this.activeTextSelection = null;
		this.past = [];
		this.future = [];
		this.dirty = false;
	}

	private snapshotEntry(): EditorHistoryEntry {
		return {
			width: this.width,
			height: this.height,
			canvasState: cloneState(this.canvasState)
		};
	}

	private commit(mutator: (draft: TemplateCanvasState) => void) {
		this.past = [...this.past.slice(-39), this.snapshotEntry()];
		this.future = [];
		const next = cloneState(this.canvasState);
		mutator(next);
		this.canvasState = next;
		this.dirty = true;
	}

	applyStarterTemplate(
		input: { width: number; height: number; canvasState: TemplateCanvasState },
		options?: { preserveBackgroundImage?: boolean }
	) {
		this.past = [...this.past.slice(-39), this.snapshotEntry()];
		this.future = [];
		const next = cloneState(input.canvasState);
		if (options?.preserveBackgroundImage && this.canvasState.background.imageUrl) {
			next.background = structuredClone($state.snapshot(this.canvasState.background));
		}
		this.width = input.width;
		this.height = input.height;
		this.canvasState = next;
		this.selectedIds = [];
		this.activeTextSelection = null;
		this.dirty = true;
	}

	undo() {
		const previous = this.past.at(-1);
		if (!previous) return;
		this.future = [this.snapshotEntry(), ...this.future];
		this.past = this.past.slice(0, -1);
		this.width = previous.width;
		this.height = previous.height;
		this.canvasState = previous.canvasState;
		this.dirty = true;
	}

	redo() {
		const next = this.future[0];
		if (!next) return;
		this.past = [...this.past, this.snapshotEntry()];
		this.future = this.future.slice(1);
		this.width = next.width;
		this.height = next.height;
		this.canvasState = next.canvasState;
		this.dirty = true;
	}

	setCanvasSize(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.dirty = true;
	}

	setManualZoom(nextZoom: number) {
		this.autoFitZoom = false;
		this.zoom = Math.max(0.2, Math.min(2, Number(nextZoom.toFixed(2))));
	}

	enableAutoFitZoom() {
		this.autoFitZoom = true;
	}

	setBackground(patch: Partial<TemplateBackground>) {
		this.commit((draft) => {
			draft.background = { ...draft.background, ...patch };
		});
	}

	addPlaceholder(criterion: CriterionDefinition, position?: { x: number; y: number }) {
		const id = makeId('txt');
		const boxWidth = 520;
		const boxHeight = 72;
		const x = position
			? Math.max(0, Math.min(this.width - boxWidth, Math.round(position.x - boxWidth / 2)))
			: Math.round(this.width / 2 - boxWidth / 2);
		const y = position
			? Math.max(0, Math.min(this.height - boxHeight, Math.round(position.y - boxHeight / 2)))
			: Math.round(this.height / 2 - boxHeight / 2);

		const defaultFallback =
			criterion.key === 'rank' || criterion.key === 'ranking'
				? 'Certificate of Participation'
				: (criterion.defaultValue ?? '');

		const el: StaticTextCanvasElement = {
			id,
			name: criterion.label,
			type: 'text',
			text: `{{${criterion.key}}}`,
			fallbackText: defaultFallback,
			x,
			y,
			width: boxWidth,
			height: boxHeight,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			fontFamily: 'Georgia',
			fontSize: 36,
			fontWeight: 700,
			fontStyle: 'normal',
			textDecoration: '',
			textTransform: 'none',
			fill: '#000000',
			align: 'center',
			verticalAlign: 'middle',
			lineHeight: 1.2,
			letterSpacing: 0,
			wrap: 'word',
			ellipsis: false,
			autoFit: true,
			minFontSize: 16
		};
		this.commit((draft) => {
			draft.elements.push(el);
		});
		this.selectedId = id;
	}

	addStaticText(text = 'Certificate Text', position?: { x: number; y: number }) {
		const id = makeId('txt');
		const boxWidth = 400;
		const boxHeight = 48;
		const x = position
			? Math.max(0, Math.min(this.width - boxWidth, Math.round(position.x - boxWidth / 2)))
			: Math.round(this.width / 2 - boxWidth / 2);
		const y = position
			? Math.max(0, Math.min(this.height - boxHeight, Math.round(position.y - boxHeight / 2)))
			: Math.round(this.height / 2 - boxHeight / 2);

		const el: StaticTextCanvasElement = {
			id,
			name: 'Text Block',
			type: 'text',
			text,
			x,
			y,
			width: boxWidth,
			height: boxHeight,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			fontFamily: 'Inter',
			fontSize: 20,
			fontWeight: 500,
			fontStyle: 'normal',
			textDecoration: '',
			textTransform: 'none',
			fill: '#000000',
			align: 'center',
			verticalAlign: 'middle',
			lineHeight: 1.3,
			letterSpacing: 0,
			wrap: 'word',
			ellipsis: false,
			autoFit: false,
			minFontSize: 12
		};
		this.commit((draft) => {
			draft.elements.push(el);
		});
		this.selectedId = id;
	}

	addShape(shapeKind: ShapeCanvasElement['shapeKind'], position?: { x: number; y: number }) {
		const id = makeId('shp');
		const isLine = shapeKind === 'line';
		const boxWidth = 280;
		const boxHeight = isLine ? 2 : 120;
		const x = position
			? Math.max(0, Math.min(this.width - boxWidth, Math.round(position.x - boxWidth / 2)))
			: Math.round(this.width / 2 - boxWidth / 2);
		const y = position
			? Math.max(0, Math.min(this.height - boxHeight, Math.round(isLine ? position.y : position.y - boxHeight / 2)))
			: Math.round(isLine ? this.height / 2 : this.height / 2 - boxHeight / 2);

		const el: ShapeCanvasElement = {
			id,
			name: shapeKind === 'rect' ? 'Rectangle' : shapeKind === 'circle' ? 'Circle' : 'Line',
			type: 'shape',
			shapeKind,
			x,
			y,
			width: boxWidth,
			height: boxHeight,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			fill: 'transparent',
			stroke: '#000000',
			strokeWidth: 2,
			cornerRadius: shapeKind === 'rect' ? 4 : 0
		};
		this.commit((draft) => {
			draft.elements.push(el);
		});
		this.selectedId = id;
	}

	addImage(
		src: string,
		name: string,
		assetId?: string,
		dimensions?: { width: number; height: number },
		sourceMeta?: { originalSrc?: string; originalAssetId?: string; editState?: ImageEditState }
	) {
		const id = makeId('img');
		const boxWidth = Math.max(40, Math.round(dimensions?.width ?? 200));
		const boxHeight = Math.max(40, Math.round(dimensions?.height ?? 200));
		this.commit((draft) => {
			draft.elements.push({
				id,
				name,
				type: 'image',
				src,
				assetId,
				originalSrc: sourceMeta?.originalSrc ?? src,
				originalAssetId: sourceMeta?.originalAssetId ?? assetId,
				editState: sourceMeta?.editState,
				keepAspectRatio: true,
				x: Math.round(this.width / 2 - boxWidth / 2),
				y: Math.round(this.height / 2 - boxHeight / 2),
				width: boxWidth,
				height: boxHeight,
				rotation: 0,
				opacity: 1,
				visible: true,
				locked: false
			});
		});
		this.selectedId = id;
	}

	addSignature(position?: { x: number; y: number }) {
		const id = makeId('sig');
		const boxWidth = 240;
		const boxHeight = 90;
		const x = position
			? Math.max(0, Math.min(this.width - boxWidth, Math.round(position.x - boxWidth / 2)))
			: Math.round(this.width / 2 - boxWidth / 2);
		const y = position
			? Math.max(0, Math.min(this.height - boxHeight, Math.round(position.y - boxHeight / 2)))
			: Math.round(this.height / 2 - boxHeight / 2);

		this.commit((draft) => {
			draft.elements.push({
				id,
				name: 'Signature',
				type: 'signature',
				src: '',
				keepAspectRatio: true,
				x,
				y,
				width: boxWidth,
				height: boxHeight,
				rotation: 0,
				opacity: 1,
				visible: true,
				locked: false
			});
		});
		this.selectedId = id;
	}

	pushHistorySnapshot() {
		this.past = [...this.past.slice(-39), this.snapshotEntry()];
		this.future = [];
	}

	updateElement(id: string, patch: Partial<CanvasElement>, recordHistory = true) {
		if (recordHistory) {
			this.commit((draft) => {
				const idx = draft.elements.findIndex((el) => el.id === id);
				if (idx === -1) return;
				draft.elements[idx] = { ...draft.elements[idx], ...patch } as CanvasElement;
			});
			return;
		}

		const next = cloneState(this.canvasState);
		const idx = next.elements.findIndex((el) => el.id === id);
		if (idx === -1) return;
		next.elements[idx] = { ...next.elements[idx], ...patch } as CanvasElement;
		this.canvasState = next;
		this.dirty = true;
	}

	updateElements(
		updates: Array<{ id: string; patch: Partial<CanvasElement> }>,
		recordHistory = true
	) {
		if (updates.length === 0) return;
		const patchMap = new Map(updates.map((u) => [u.id, u.patch]));

		const apply = (draft: TemplateCanvasState) => {
			for (let i = 0; i < draft.elements.length; i++) {
				const patch = patchMap.get(draft.elements[i].id);
				if (patch) {
					draft.elements[i] = { ...draft.elements[i], ...patch } as CanvasElement;
				}
			}
		};

		if (recordHistory) {
			this.commit(apply);
			return;
		}
		const next = cloneState(this.canvasState);
		apply(next);
		this.canvasState = next;
		this.dirty = true;
	}

	moveSelectedBy(dx: number, dy: number) {
		const targets = this.selectedElements.filter((el) => !el.locked);
		if (targets.length === 0) return;
		this.updateElements(
			targets.map((el) => ({ id: el.id, patch: { x: el.x + dx, y: el.y + dy } }))
		);
	}

	deleteElement(id: string) {
		this.deleteElements([id]);
	}

	deleteElements(ids: string[]) {
		const toDelete = new Set(ids);
		if (toDelete.size === 0) return;
		this.commit((draft) => {
			draft.elements = draft.elements.filter((el) => !toDelete.has(el.id));
		});
		this.selectedIds = this.selectedIds.filter((id) => !toDelete.has(id));
		if (this.activeTextSelection && toDelete.has(this.activeTextSelection.elementId)) {
			this.activeTextSelection = null;
		}
	}

	duplicateElement(id: string) {
		this.duplicateElements([id]);
	}

	duplicateSelected() {
		if (this.selectedIds.length === 0) return;
		this.duplicateElements(this.selectedIds);
	}

	copySelected(): boolean {
		if (this.selectedElements.length === 0) return false;
		this.clipboard = this.selectedElements.map((el) => structuredClone($state.snapshot(el)));
		this.pasteOffsetStep = 0;
		return true;
	}

	cutSelected(): boolean {
		if (!this.copySelected()) return false;
		const unlockedIds = this.selectedElements.filter((el) => !el.locked).map((el) => el.id);
		if (unlockedIds.length > 0) {
			this.deleteElements(unlockedIds);
		}
		return true;
	}

	pasteClipboard(): boolean {
		if (this.clipboard.length === 0) return false;
		this.pasteOffsetStep += 1;
		const offset = 24 * this.pasteOffsetStep;
		const groupRemap = new Map<string, string>();

		const copies = this.clipboard.map((source) => {
			const copy = structuredClone($state.snapshot(source));
			copy.id = makeId(source.type.slice(0, 3));
			copy.name = source.name.endsWith(' Copy') ? source.name : `${source.name} Copy`;
			copy.x = Math.max(0, Math.min(Math.max(0, this.width - copy.width), source.x + offset));
			copy.y = Math.max(0, Math.min(Math.max(0, this.height - copy.height), source.y + offset));
			if (copy.groupId) {
				let mapped = groupRemap.get(copy.groupId);
				if (!mapped) {
					mapped = makeId('grp');
					groupRemap.set(copy.groupId, mapped);
				}
				copy.groupId = mapped;
			}
			return copy;
		});

		this.commit((draft) => {
			draft.elements.push(...copies);
		});
		this.selectedIds = copies.map((c) => c.id);
		return true;
	}

	duplicateElements(ids: string[]) {
		const idSet = new Set(ids);
		const sources = this.canvasState.elements.filter((el) => idSet.has(el.id));
		if (sources.length === 0) return;
		const groupRemap = new Map<string, string>();
		const copies = sources.map((source) => {
			const copy = structuredClone($state.snapshot(source));
			copy.id = makeId(source.type.slice(0, 3));
			copy.name = `${source.name} Copy`;
			copy.x += 24;
			copy.y += 24;
			if (copy.groupId) {
				let mapped = groupRemap.get(copy.groupId);
				if (!mapped) {
					mapped = makeId('grp');
					groupRemap.set(copy.groupId, mapped);
				}
				copy.groupId = mapped;
			}
			return copy;
		});
		this.commit((draft) => {
			draft.elements.push(...copies);
		});
		this.selectedIds = copies.map((c) => c.id);
	}

	alignSelectedElements(
		mode:
			| 'left'
			| 'center-x'
			| 'right'
			| 'top'
			| 'center-y'
			| 'bottom'
			| 'distribute-h'
			| 'distribute-v'
			| 'canvas-center-x'
			| 'canvas-center-y'
	) {
		const items = this.selectedElements.filter((el) => !el.locked);
		if (items.length < 2) return;

		const getBox = (el: CanvasElement) => {
			const isLine = el.type === 'shape' && el.shapeKind === 'line';
			const h = isLine ? Math.max(2, el.strokeWidth || 2) : el.height;
			const top = isLine ? el.y - h / 2 : el.y;
			return { el, isLine, left: el.x, right: el.x + el.width, top, bottom: top + h, w: el.width, h };
		};

		const boxes = items.map(getBox);
		const minLeft = Math.min(...boxes.map((b) => b.left));
		const maxRight = Math.max(...boxes.map((b) => b.right));
		const minTop = Math.min(...boxes.map((b) => b.top));
		const maxBottom = Math.max(...boxes.map((b) => b.bottom));
		const groupCenterX = (minLeft + maxRight) / 2;
		const groupCenterY = (minTop + maxBottom) / 2;

		const updates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];

		if (mode === 'left') {
			for (const b of boxes) updates.push({ id: b.el.id, patch: { x: Math.round(minLeft) } });
		} else if (mode === 'right') {
			for (const b of boxes) updates.push({ id: b.el.id, patch: { x: Math.round(maxRight - b.w) } });
		} else if (mode === 'center-x') {
			for (const b of boxes) updates.push({ id: b.el.id, patch: { x: Math.round(groupCenterX - b.w / 2) } });
		} else if (mode === 'top') {
			for (const b of boxes) {
				updates.push({ id: b.el.id, patch: { y: Math.round(b.isLine ? minTop + b.h / 2 : minTop) } });
			}
		} else if (mode === 'bottom') {
			for (const b of boxes) {
				updates.push({
					id: b.el.id,
					patch: { y: Math.round(b.isLine ? maxBottom - b.h / 2 : maxBottom - b.h) }
				});
			}
		} else if (mode === 'center-y') {
			for (const b of boxes) {
				updates.push({
					id: b.el.id,
					patch: { y: Math.round(b.isLine ? groupCenterY : groupCenterY - b.h / 2) }
				});
			}
		} else if (mode === 'canvas-center-x') {
			const dx = Math.round(this.width / 2 - groupCenterX);
			for (const b of boxes) updates.push({ id: b.el.id, patch: { x: b.el.x + dx } });
		} else if (mode === 'canvas-center-y') {
			const dy = Math.round(this.height / 2 - groupCenterY);
			for (const b of boxes) updates.push({ id: b.el.id, patch: { y: b.el.y + dy } });
		} else if (mode === 'distribute-h' && boxes.length >= 3) {
			const sorted = [...boxes].sort((a, b) => a.left - b.left);
			const totalW = sorted.reduce((sum, b) => sum + b.w, 0);
			const span = sorted[sorted.length - 1].right - sorted[0].left;
			const gap = (span - totalW) / (sorted.length - 1);
			let cursor = sorted[0].left;
			for (const b of sorted) {
				updates.push({ id: b.el.id, patch: { x: Math.round(cursor) } });
				cursor += b.w + gap;
			}
		} else if (mode === 'distribute-v' && boxes.length >= 3) {
			const sorted = [...boxes].sort((a, b) => a.top - b.top);
			const totalH = sorted.reduce((sum, b) => sum + b.h, 0);
			const span = sorted[sorted.length - 1].bottom - sorted[0].top;
			const gap = (span - totalH) / (sorted.length - 1);
			let cursor = sorted[0].top;
			for (const b of sorted) {
				updates.push({
					id: b.el.id,
					patch: { y: Math.round(b.isLine ? cursor + b.h / 2 : cursor) }
				});
				cursor += b.h + gap;
			}
		}

		this.updateElements(updates);
	}

	moveLayer(id: string, direction: 'up' | 'down') {
		this.commit((draft) => {
			const idx = draft.elements.findIndex((el) => el.id === id);
			if (idx === -1) return;
			const target = direction === 'up' ? idx + 1 : idx - 1;
			if (target < 0 || target >= draft.elements.length) return;
			const [item] = draft.elements.splice(idx, 1);
			draft.elements.splice(target, 0, item);
		});
	}

	reorderLayer(sourceId: string, targetId: string) {
		if (sourceId === targetId) return;
		this.commit((draft) => {
			const fromIdx = draft.elements.findIndex((el) => el.id === sourceId);
			const toIdx = draft.elements.findIndex((el) => el.id === targetId);
			if (fromIdx === -1 || toIdx === -1) return;
			const [item] = draft.elements.splice(fromIdx, 1);
			draft.elements.splice(toIdx, 0, item);
		});
	}

	alignElementOnCanvas(id: string, axis: 'center-x' | 'center-y' | 'left' | 'right') {
		const el = this.canvasState.elements.find((item) => item.id === id);
		if (!el) return;
		if (axis === 'center-x') {
			this.updateElement(id, { x: Math.round((this.width - el.width) / 2) });
		} else if (axis === 'center-y') {
			const isLine = el.type === 'shape' && el.shapeKind === 'line';
			this.updateElement(id, { y: isLine ? Math.round(this.height / 2) : Math.round((this.height - el.height) / 2) });
		} else if (axis === 'left') {
			this.updateElement(id, { x: 48 });
		} else if (axis === 'right') {
			this.updateElement(id, { x: Math.max(0, this.width - el.width - 48) });
		}
	}

	markSaved() {
		this.dirty = false;
	}
}
