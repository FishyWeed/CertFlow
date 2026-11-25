<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type KonvaType from 'konva';
	import { LAYOUT_BREAKPOINTS } from '#lib/config/layout.ts';
	import type { CanvasElement, CriterionDefinition, StaticTextCanvasElement } from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import {
		ensureFontLoaded,
		extractInlineFontFamilies,
		preloadEditorFonts,
		quoteFontFamily
	} from './fonts.ts';
	import {
		createRichTextKonvaNode,
		stripRichTextMarkup,
		type InlineFormatAction,
		type RichTextStyle
	} from './rich-text.ts';
	import { computeSnapResult, type RectBox } from './snapping.ts';
	import { findMatchingTitleRule } from './text-utils.ts';
	import {
		applyFormatToPlainRange,
		domToRichTextMarkup,
		getPlainTextSelection,
		inspectPlainRangeStyle,
		richTextMarkupToHtml,
		setPlainTextSelection
	} from './wysiwyg.ts';

	interface Props {
		editor: EditorState;
		sampleData: Record<string, string>;
		onSaveShortcut?: () => void;
	}

	let { editor, sampleData, onSaveShortcut }: Props = $props();

	let viewportEl = $state<HTMLDivElement | null>(null);
	let containerEl = $state<HTMLDivElement | null>(null);
	let Konva: typeof KonvaType | null = null;
	let stage: KonvaType.Stage | null = null;
	let bgLayer: KonvaType.Layer | null = null;
	let contentLayer: KonvaType.Layer | null = null;
	let guideLayer: KonvaType.Layer | null = null;
	let transformer: KonvaType.Transformer | null = null;
	let resizeObserver: ResizeObserver | null = null;

	function handleCtrlWheel(event: WheelEvent) {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();
		const step = event.deltaY < 0 ? 0.08 : -0.08;
		editor.setManualZoom(editor.zoom + step);
	}

	const imageCache = new Map<string, HTMLImageElement>();
	const SNAP_THRESHOLD = 6;

	function computeFitZoom() {
		if (!viewportEl || !editor.autoFitZoom) return;
		const rect = viewportEl.getBoundingClientRect();
		if (rect.width <= 0) return;

		const isSmall = window.innerWidth < LAYOUT_BREAKPOINTS.tabletMin;
		const horizontalPad = isSmall ? 24 : 56;
		const availW = Math.max(220, rect.width - horizontalPad);
		const fitW = availW / editor.width;

		// On desktop height-locked viewport also respect available height; on mobile/tablet fit width cleanly.
		const fitH =
			!isSmall && rect.height > 320 ? (rect.height - 48) / editor.height : Number.POSITIVE_INFINITY;

		const next = Math.max(0.22, Math.min(1, fitW, fitH));
		editor.zoom = Number(next.toFixed(3));

		if (transformer) {
			transformer.anchorSize(isSmall ? 13 : 9);
		}
	}

	function getCachedImage(src: string, onLoad: () => void): HTMLImageElement | null {
		const existing = imageCache.get(src);
		if (existing?.complete && existing.naturalWidth > 0) return existing;
		if (existing) return null;

		const img = new Image();
		// Only set anonymous CORS for external URLs so same-origin /api/assets requests include session cookies.
		if (
			/^https?:\/\//i.test(src) &&
			typeof window !== 'undefined' &&
			!src.startsWith(window.location.origin)
		) {
			img.crossOrigin = 'anonymous';
		}
		img.onload = onLoad;
		img.onerror = () => {
			imageCache.delete(src);
		};
		img.src = src;
		imageCache.set(src, img);
		return null;
	}

	function clearGuides() {
		guideLayer?.destroyChildren();
		guideLayer?.batchDraw();
	}

	let marqueeActiveState = false;
	let isElementDragging = false;

	// Direct on-canvas WYSIWYG text editing state (double-click any text element to edit live).
	const CANVAS_INLINE_FIELD_ID = '__canvas_inline_editor__';
	let inlineEdit = $state<{ elementId: string; ruleId: string | null; label: string } | null>(null);
	let inlineEditorEl = $state<HTMLDivElement | null>(null);
	let inlineSavedSelection = $state<{ start: number; end: number } | null>(null);
	let inlineLatestMarkup = '';
	let inlineLastSyncedHtml = '';

	const editingTextEl = $derived.by<StaticTextCanvasElement | null>(() => {
		if (!inlineEdit) return null;
		const found = editor.canvasState.elements.find((e) => e.id === inlineEdit!.elementId);
		if (!found || found.type !== 'text' || found.locked || !found.visible) return null;
		return found;
	});

	const editingBaseStyle = $derived.by<RichTextStyle | null>(() => {
		if (!editingTextEl) return null;
		return {
			fontFamily: editingTextEl.fontFamily,
			fontSize: editingTextEl.fontSize,
			fontWeight: editingTextEl.fontWeight,
			fontStyle: editingTextEl.fontStyle,
			underline: editingTextEl.textDecoration === 'underline',
			fill: editingTextEl.fill
		};
	});

	const editingMarkup = $derived.by(() => {
		if (!editingTextEl || !inlineEdit) return '';
		if (inlineEdit.ruleId) {
			const rule = editingTextEl.rules?.find((r) => r.id === inlineEdit!.ruleId);
			return rule?.output ?? '';
		}
		return editingTextEl.text;
	});

	function commitInlineMarkup(nextMarkup: string) {
		if (!editingTextEl || !inlineEdit) return;
		inlineLatestMarkup = nextMarkup;
		if (inlineEdit.ruleId && editingTextEl.rules) {
			const nextRules = editingTextEl.rules.map((r) =>
				r.id === inlineEdit!.ruleId ? { ...r, output: nextMarkup } : r
			);
			editor.updateElement(editingTextEl.id, { rules: nextRules }, false);
		} else {
			editor.updateElement(editingTextEl.id, { text: nextMarkup }, false);
		}
	}

	function publishInlineSelection(markup: string, start: number, end: number) {
		if (!editingTextEl || !editingBaseStyle || !inlineEdit) return;
		const plain = stripRichTextMarkup(markup);
		const from = Math.max(0, Math.min(plain.length, Math.min(start, end)));
		const to = Math.max(from, Math.min(plain.length, Math.max(start, end)));
		inlineSavedSelection = { start: from, end: to };

		if (to > from) {
			editor.setActiveTextSelection({
				elementId: editingTextEl.id,
				fieldId: CANVAS_INLINE_FIELD_ID,
				label: inlineEdit.label,
				text: markup,
				start: from,
				end: to,
				selectedText: plain.slice(from, to),
				effectiveStyle: inspectPlainRangeStyle(markup, editingBaseStyle, from, to),
				apply: applyInlineCanvasFormat,
				clear: clearInlineHighlight
			});
		} else {
			editor.clearActiveTextSelection(CANVAS_INLINE_FIELD_ID);
		}
	}

	function syncInlineSelectionFromDom() {
		if (!inlineEditorEl) return;
		const sel = getPlainTextSelection(inlineEditorEl);
		if (!sel) return;
		publishInlineSelection(inlineLatestMarkup, sel.start, sel.end);
	}

	function getInlineActiveSelection(): { start: number; end: number } {
		const plainLen = stripRichTextMarkup(inlineLatestMarkup).length;
		if (inlineEditorEl && document.activeElement === inlineEditorEl) {
			const live = getPlainTextSelection(inlineEditorEl);
			if (live) return live;
		}
		if (inlineSavedSelection) {
			return {
				start: Math.max(0, Math.min(plainLen, inlineSavedSelection.start)),
				end: Math.max(0, Math.min(plainLen, inlineSavedSelection.end))
			};
		}
		return { start: plainLen, end: plainLen };
	}

	function clearInlineHighlight() {
		inlineSavedSelection = null;
		editor.clearActiveTextSelection(CANVAS_INLINE_FIELD_ID);
		if (inlineEditorEl && document.activeElement === inlineEditorEl) {
			const live = getPlainTextSelection(inlineEditorEl);
			if (live) setPlainTextSelection(inlineEditorEl, live.end, live.end);
		}
	}

	function applyInlineCanvasFormat(action: InlineFormatAction, options?: { restoreFocus?: boolean }) {
		if (!editingBaseStyle) return;
		if (action.kind === 'font') ensureFontLoaded(action.value);
		const { start, end } = getInlineActiveSelection();
		const nextMarkup = applyFormatToPlainRange(inlineLatestMarkup, editingBaseStyle, start, end, action);
		commitInlineMarkup(nextMarkup);

		if (inlineEditorEl) {
			const nextHtml = richTextMarkupToHtml(nextMarkup, editingBaseStyle, { zoom: editor.zoom });
			inlineEditorEl.innerHTML = nextHtml;
			inlineLastSyncedHtml = nextHtml;
		}

		publishInlineSelection(nextMarkup, start, end);

		if (options?.restoreFocus !== false) {
			requestAnimationFrame(() => {
				if (!inlineEditorEl) return;
				inlineEditorEl.focus();
				setPlainTextSelection(inlineEditorEl, start, end);
			});
		}
	}

	function startInlineTextEdit(el: StaticTextCanvasElement) {
		if (el.locked) return;
		editor.selectElement(el.id, { ignoreGroup: true });
		editor.pushHistorySnapshot();

		let ruleId: string | null = null;
		let label = 'Canvas Text';
		if (editor.previewMode === 'sample' && el.rules && el.rules.length > 0) {
			const matched = findMatchingTitleRule(el.rules, sampleData);
			if (matched) {
				const idx = el.rules.findIndex((r) => r.id === matched.id);
				ruleId = matched.id;
				label = `Rule ${idx + 1}`;
			}
		}

		inlineLastSyncedHtml = '';
		inlineSavedSelection = null;
		inlineEdit = { elementId: el.id, ruleId, label };

		requestAnimationFrame(() => {
			if (!inlineEditorEl) return;
			inlineEditorEl.focus();
			const plainLen = stripRichTextMarkup(inlineLatestMarkup).length;
			setPlainTextSelection(inlineEditorEl, plainLen, plainLen);
		});
	}

	function finishInlineTextEdit() {
		if (!inlineEdit) return;
		editor.clearActiveTextSelection(CANVAS_INLINE_FIELD_ID);
		inlineEdit = null;
		inlineSavedSelection = null;
		inlineLastSyncedHtml = '';
	}

	function handleInlineCanvasInput() {
		if (!inlineEditorEl || !editingBaseStyle) return;
		const nextMarkup = domToRichTextMarkup(inlineEditorEl, editingBaseStyle);
		inlineLastSyncedHtml = inlineEditorEl.innerHTML;
		commitInlineMarkup(nextMarkup);
		syncInlineSelectionFromDom();
	}

	function handleInlineCanvasPaste(event: ClipboardEvent) {
		event.preventDefault();
		const plain = event.clipboardData?.getData('text/plain') ?? '';
		if (!plain || !inlineEditorEl || !editingBaseStyle) return;
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0) {
			const range = sel.getRangeAt(0);
			range.deleteContents();
			const node = document.createTextNode(plain);
			range.insertNode(node);
			range.setStartAfter(node);
			range.setEndAfter(node);
			sel.removeAllRanges();
			sel.addRange(range);
			handleInlineCanvasInput();
		}
	}

	function handleInlineCanvasKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			finishInlineTextEdit();
			return;
		}
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		if (mod && key === 'b') {
			event.preventDefault();
			syncInlineSelectionFromDom();
			applyInlineCanvasFormat({ kind: 'bold' });
		} else if (mod && key === 'i') {
			event.preventDefault();
			syncInlineSelectionFromDom();
			applyInlineCanvasFormat({ kind: 'italic' });
		} else if (mod && key === 'u') {
			event.preventDefault();
			syncInlineSelectionFromDom();
			applyInlineCanvasFormat({ kind: 'underline' });
		}
	}

	// Sync WYSIWYG overlay HTML whenever markup, baseStyle or zoom changes while editing on canvas.
	$effect(() => {
		if (!inlineEdit || !editingTextEl || !editingBaseStyle) return;
		const markup = editingMarkup;
		const zoom = editor.zoom;
		inlineLatestMarkup = markup;
		if (!inlineEditorEl) return;
		const desiredHtml = richTextMarkupToHtml(markup, editingBaseStyle, { zoom });
		if (desiredHtml === inlineLastSyncedHtml) return;
		const wasFocused = document.activeElement === inlineEditorEl;
		const prevSel = wasFocused ? getPlainTextSelection(inlineEditorEl) : inlineSavedSelection;
		inlineEditorEl.innerHTML = desiredHtml;
		inlineLastSyncedHtml = desiredHtml;
		if (wasFocused && prevSel) {
			setPlainTextSelection(inlineEditorEl, prevSel.start, prevSel.end);
		}
	});

	// Exit inline canvas editing if the user switches selection away from the edited element.
	$effect(() => {
		if (inlineEdit && !editor.isSelected(inlineEdit.elementId)) {
			finishInlineTextEdit();
		}
	});

	function getLineEndpoints(el: { x: number; y: number; width: number; rotation: number }) {
		const rad = ((el.rotation || 0) * Math.PI) / 180;
		return {
			x1: el.x,
			y1: el.y,
			x2: el.x + el.width * Math.cos(rad),
			y2: el.y + el.width * Math.sin(rad)
		};
	}

	function snapLineAngleDeg(rawDeg: number, shiftKey: boolean): number {
		if (shiftKey) {
			return Math.round(rawDeg / 15) * 15;
		}
		const nearestCardinal = Math.round(rawDeg / 90) * 90;
		if (Math.abs(rawDeg - nearestCardinal) <= 2.5) {
			return nearestCardinal;
		}
		return rawDeg;
	}

	function normaliseAngleDeg(deg: number): number {
		let d = Math.round(deg) % 360;
		if (d > 180) d -= 360;
		if (d <= -180) d += 360;
		return d === -0 ? 0 : d;
	}

	function getMarqueeElementBounds(el: CanvasElement) {
		if (el.type === 'shape' && el.shapeKind === 'line') {
			const { x1, y1, x2, y2 } = getLineEndpoints(el);
			const pad = Math.max(6, (el.strokeWidth || 2) / 2);
			const minX = Math.min(x1, x2) - pad;
			const minY = Math.min(y1, y2) - pad;
			const maxX = Math.max(x1, x2) + pad;
			const maxY = Math.max(y1, y2) + pad;
			return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
		}
		return { x: el.x, y: el.y, width: el.width, height: el.height };
	}

	function findMarqueeHitIds(rx: number, ry: number, rw: number, rh: number): string[] {
		const directIds = editor.canvasState.elements
			.filter((el) => {
				if (!el.visible || el.locked) return false;
				const isFrame =
					el.type === 'shape' &&
					el.shapeKind !== 'line' &&
					el.width > editor.width * 0.7 &&
					el.height > editor.height * 0.7;
				if (isFrame) return false;
				const b = getMarqueeElementBounds(el);
				return b.x < rx + rw && b.x + b.width > rx && b.y < ry + rh && b.y + b.height > ry;
			})
			.map((el) => el.id);

		if (directIds.length === 0) return [];
		const groupIds = new Set<string>();
		for (const id of directIds) {
			const found = editor.canvasState.elements.find((el) => el.id === id);
			if (found?.groupId) groupIds.add(found.groupId);
		}
		if (groupIds.size === 0) return directIds;

		const expanded = new Set(directIds);
		for (const el of editor.canvasState.elements) {
			if (el.visible && !el.locked && el.groupId && groupIds.has(el.groupId)) {
				expanded.add(el.id);
			}
		}
		return Array.from(expanded);
	}

	function clearMarqueePreviewBorders() {
		if (!guideLayer) return;
		for (const node of guideLayer.find('.marquee-hit-outline')) {
			node.destroy();
		}
	}

	function renderMarqueePreviewBorders(ids: string[]) {
		if (!guideLayer || !Konva) return;
		clearMarqueePreviewBorders();
		const zoom = Math.max(0.2, editor.zoom);
		const strokeW = 2 / zoom;
		const idSet = new Set(ids);

		for (const el of editor.canvasState.elements) {
			if (!idSet.has(el.id) || !el.visible) continue;

			if (el.type === 'shape' && el.shapeKind === 'line') {
				const { x1, y1, x2, y2 } = getLineEndpoints(el);
				const glowW = Math.max(6, (el.strokeWidth || 2) + 4) / zoom;
				guideLayer.add(
					new Konva.Line({
						name: 'marquee-hit-outline',
						points: [x1, y1, x2, y2],
						stroke: 'rgba(79, 70, 229, 0.3)',
						strokeWidth: glowW,
						lineCap: 'round'
					}),
					new Konva.Line({
						name: 'marquee-hit-outline',
						points: [x1, y1, x2, y2],
						stroke: '#4f46e5',
						strokeWidth: strokeW,
						lineCap: 'round'
					}),
					new Konva.Circle({
						name: 'marquee-hit-outline',
						x: x1,
						y: y1,
						radius: 4 / zoom,
						fill: '#ffffff',
						stroke: '#4f46e5',
						strokeWidth: 1.5 / zoom
					}),
					new Konva.Circle({
						name: 'marquee-hit-outline',
						x: x2,
						y: y2,
						radius: 4 / zoom,
						fill: '#ffffff',
						stroke: '#4f46e5',
						strokeWidth: 1.5 / zoom
					})
				);
			} else if (el.type === 'shape' && el.shapeKind === 'circle') {
				guideLayer.add(
					new Konva.Ellipse({
						name: 'marquee-hit-outline',
						x: el.x + el.width / 2,
						y: el.y + el.height / 2,
						radiusX: el.width / 2,
						radiusY: el.height / 2,
						rotation: el.rotation,
						fill: 'rgba(79, 70, 229, 0.08)',
						stroke: '#4f46e5',
						strokeWidth: strokeW
					})
				);
			} else {
				guideLayer.add(
					new Konva.Rect({
						name: 'marquee-hit-outline',
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						fill: 'rgba(79, 70, 229, 0.08)',
						stroke: '#4f46e5',
						strokeWidth: strokeW,
						cornerRadius: 2 / zoom
					})
				);
			}
		}
	}

	function clearHoverOutline() {
		if (!guideLayer) return;
		const existing = guideLayer.find('.hover-outline');
		if (existing.length > 0) {
			for (const node of existing) node.destroy();
			guideLayer.batchDraw();
		}
	}

	function renderHoverOutline(el: CanvasElement) {
		if (!guideLayer || !Konva || marqueeActiveState || isElementDragging) return;
		if (editor.isSelected(el.id) || el.locked) return;
		clearHoverOutline();
		const zoom = Math.max(0.2, editor.zoom);
		const strokeW = 1.5 / zoom;

		if (el.type === 'shape' && el.shapeKind === 'line') {
			const { x1, y1, x2, y2 } = getLineEndpoints(el);
			guideLayer.add(
				new Konva.Line({
					name: 'hover-outline',
					points: [x1, y1, x2, y2],
					stroke: 'rgba(79, 70, 229, 0.5)',
					strokeWidth: Math.max(4, (el.strokeWidth || 2) + 3) / zoom,
					lineCap: 'round'
				})
			);
		} else if (el.type === 'shape' && el.shapeKind === 'circle') {
			guideLayer.add(
				new Konva.Ellipse({
					name: 'hover-outline',
					x: el.x + el.width / 2,
					y: el.y + el.height / 2,
					radiusX: el.width / 2,
					radiusY: el.height / 2,
					rotation: el.rotation,
					stroke: 'rgba(79, 70, 229, 0.65)',
					strokeWidth: strokeW
				})
			);
		} else {
			guideLayer.add(
				new Konva.Rect({
					name: 'hover-outline',
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					rotation: el.rotation,
					stroke: 'rgba(79, 70, 229, 0.65)',
					strokeWidth: strokeW,
					cornerRadius: 2 / zoom
				})
			);
		}
		guideLayer.batchDraw();
	}

	function buildSiblingBoxes(excludeIds: Set<string>): RectBox[] {
		return editor.canvasState.elements
			.filter((item) => item.visible && !excludeIds.has(item.id))
			.map((item) => {
				const itemIsLine = item.type === 'shape' && item.shapeKind === 'line';
				const itemH = itemIsLine ? Math.max(2, item.strokeWidth || 2) : item.height;
				return {
					id: item.id,
					x: item.x,
					y: itemIsLine ? item.y - itemH / 2 : item.y,
					width: item.width,
					height: itemH,
					isFrame:
						item.type === 'shape' &&
						item.shapeKind !== 'line' &&
						item.width > editor.width * 0.7 &&
						item.height > editor.height * 0.7
				};
			});
	}

	function renderSnapGuides(snap: ReturnType<typeof computeSnapResult>) {
		if (!Konva || !guideLayer) return;

		// Render alignment guides (indigo dashed for canvas centre, rose for sibling edges and centres).
		for (const g of snap.alignGuides) {
			const isCanvas = g.kind === 'canvas';
			guideLayer.add(
				new Konva.Line({
					points:
						g.orientation === 'vertical'
							? [g.position, g.start, g.position, g.end]
							: [g.start, g.position, g.end, g.position],
					stroke: isCanvas ? '#4f46e5' : '#e11d48',
					strokeWidth: 1,
					dash: isCanvas ? [6, 4] : undefined
				})
			);
		}

		// Render equal-spacing gap bars with end ticks and pixel distance badges.
		const cap = 5;
		for (const sg of snap.spacingGuides) {
			guideLayer.add(
				new Konva.Line({
					points: [sg.x1, sg.y1, sg.x2, sg.y2],
					stroke: '#e11d48',
					strokeWidth: 1.5
				})
			);

			if (sg.orientation === 'vertical') {
				guideLayer.add(
					new Konva.Line({ points: [sg.x1 - cap, sg.y1, sg.x1 + cap, sg.y1], stroke: '#e11d48', strokeWidth: 1.5 }),
					new Konva.Line({ points: [sg.x2 - cap, sg.y2, sg.x2 + cap, sg.y2], stroke: '#e11d48', strokeWidth: 1.5 })
				);
			} else {
				guideLayer.add(
					new Konva.Line({ points: [sg.x1, sg.y1 - cap, sg.x1, sg.y1 + cap], stroke: '#e11d48', strokeWidth: 1.5 }),
					new Konva.Line({ points: [sg.x2, sg.y2 - cap, sg.x2, sg.y2 + cap], stroke: '#e11d48', strokeWidth: 1.5 })
				);
			}

			const midX = (sg.x1 + sg.x2) / 2;
			const midY = (sg.y1 + sg.y2) / 2;
			const labelText = `${sg.gapPx}px`;
			const badgeW = Math.max(34, labelText.length * 7 + 10);
			const badgeH = 18;
			const offsetX = sg.orientation === 'vertical' ? 8 : -badgeW / 2;
			const offsetY = sg.orientation === 'vertical' ? -badgeH / 2 : -badgeH - 6;

			guideLayer.add(
				new Konva.Rect({
					x: midX + offsetX,
					y: midY + offsetY,
					width: badgeW,
					height: badgeH,
					fill: '#e11d48',
					cornerRadius: 4
				}),
				new Konva.Text({
					x: midX + offsetX,
					y: midY + offsetY + 3,
					width: badgeW,
					height: badgeH,
					text: labelText,
					fontSize: 11,
					fontFamily: 'Inter, sans-serif',
					fontStyle: 'bold',
					fill: '#ffffff',
					align: 'center'
				})
			);
		}

		guideLayer.batchDraw();
	}

	function applySmartSnap(node: KonvaType.Node, el: CanvasElement, evt?: KonvaType.KonvaEventObject<DragEvent>) {
		if (!Konva || !guideLayer) return;
		guideLayer.destroyChildren();

		// Hold Alt while dragging to temporarily bypass snapping.
		if (evt?.evt?.altKey) {
			guideLayer.batchDraw();
			return;
		}

		const isCircle = el.type === 'shape' && el.shapeKind === 'circle';
		const isLine = el.type === 'shape' && el.shapeKind === 'line';
		const effectiveHeight = isLine ? Math.max(2, el.strokeWidth || 2) : el.height;
		const currentX = isCircle ? node.x() - el.width / 2 : node.x();
		const currentY = isCircle
			? node.y() - el.height / 2
			: isLine
				? node.y() - effectiveHeight / 2
				: node.y();

		const activeBox: RectBox = {
			id: el.id,
			x: currentX,
			y: currentY,
			width: el.width,
			height: effectiveHeight
		};

		const siblingBoxes = buildSiblingBoxes(new Set([el.id]));
		const snap = computeSnapResult(activeBox, siblingBoxes, editor.width, editor.height, SNAP_THRESHOLD);

		if (isCircle) {
			node.x(snap.x + el.width / 2);
			node.y(snap.y + el.height / 2);
		} else if (isLine) {
			node.x(snap.x);
			node.y(snap.y + effectiveHeight / 2);
		} else {
			node.x(snap.x);
			node.y(snap.y);
		}

		renderSnapGuides(snap);
	}

	function computeGroupSnapDelta(
		groupStartBox: { x: number; y: number; width: number; height: number },
		rawDx: number,
		rawDy: number,
		selectedIdSet: Set<string>,
		evt?: KonvaType.KonvaEventObject<DragEvent>
	): { dx: number; dy: number } {
		if (!Konva || !guideLayer) return { dx: rawDx, dy: rawDy };
		guideLayer.destroyChildren();

		if (evt?.evt?.altKey) {
			guideLayer.batchDraw();
			return { dx: rawDx, dy: rawDy };
		}

		const activeGroupBox: RectBox = {
			id: '__group__',
			x: groupStartBox.x + rawDx,
			y: groupStartBox.y + rawDy,
			width: groupStartBox.width,
			height: groupStartBox.height
		};
		const siblingBoxes = buildSiblingBoxes(selectedIdSet);
		const snap = computeSnapResult(
			activeGroupBox,
			siblingBoxes,
			editor.width,
			editor.height,
			SNAP_THRESHOLD
		);

		renderSnapGuides(snap);
		return {
			dx: snap.x - groupStartBox.x,
			dy: snap.y - groupStartBox.y
		};
	}

	function syncKonva() {
		if (!Konva || !stage || !bgLayer || !contentLayer || !transformer) return;

		const zoom = editor.zoom;
		stage.width(Math.round(editor.width * zoom));
		stage.height(Math.round(editor.height * zoom));
		stage.scale({ x: zoom, y: zoom });

		bgLayer.destroyChildren();
		bgLayer.add(
			new Konva.Rect({
				name: 'canvas-bg',
				x: 0,
				y: 0,
				width: editor.width,
				height: editor.height,
				fill: editor.canvasState.background.color || '#ffffff'
			})
		);

		if (editor.canvasState.background.imageUrl) {
			const bgImg = getCachedImage(editor.canvasState.background.imageUrl, () => syncKonva());
			if (bgImg) {
				bgLayer.add(
					new Konva.Image({
						name: 'canvas-bg',
						x: 0,
						y: 0,
						width: editor.width,
						height: editor.height,
						image: bgImg
					})
				);
			}
		}
		bgLayer.batchDraw();

		transformer.nodes([]);
		const children = contentLayer.getChildren((n) => n !== transformer);
		for (const child of children) {
			child.destroy();
		}

		const selectedNodes: KonvaType.Node[] = [];
		let syncSelectedLineHandles: ((lineNode: KonvaType.Line) => void) | null = null;
		// Shared lockstep multi-drag state so dragging any selected element moves and snaps the whole selection smoothly.
		let groupDragAnchor: {
			leadId: string;
			leadStartX: number;
			leadStartY: number;
			groupStartBox: { x: number; y: number; width: number; height: number };
			selectedIdSet: Set<string>;
			siblings: Array<{ node: KonvaType.Node; startX: number; startY: number }>;
		} | null = null;

		for (const el of editor.canvasState.elements) {
			if (!el.visible) continue;

			let node: KonvaType.Node | null = null;

			if (el.type === 'placeholder' || el.type === 'text' || el.type === 'title') {
				ensureFontLoaded(el.fontFamily, el.fontWeight, el.fontStyle, () => syncKonva());
				for (const inlineFont of extractInlineFontFamilies(el)) {
					ensureFontLoaded(inlineFont, 400, 'normal', () => syncKonva());
					ensureFontLoaded(inlineFont, 700, 'normal', () => syncKonva());
					ensureFontLoaded(inlineFont, 400, 'italic', () => syncKonva());
				}
				// Use the unified rich-text Konva renderer for all text elements so optical vertical
				// centring and shrink-only overflow fitting stay identical for plain and mixed-size text.
				node = createRichTextKonvaNode(Konva, el, sampleData, editor.previewMode, !el.locked);
			} else if (el.type === 'shape') {
				if (el.shapeKind === 'rect') {
					node = new Konva.Rect({
						id: el.id,
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked,
						fill: el.fill === 'transparent' ? undefined : el.fill,
						stroke: el.stroke,
						strokeWidth: el.strokeWidth,
						cornerRadius: el.cornerRadius ?? 0
					});
				} else if (el.shapeKind === 'circle') {
					node = new Konva.Ellipse({
						id: el.id,
						x: el.x + el.width / 2,
						y: el.y + el.height / 2,
						radiusX: el.width / 2,
						radiusY: el.height / 2,
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked,
						fill: el.fill === 'transparent' ? undefined : el.fill,
						stroke: el.stroke,
						strokeWidth: el.strokeWidth
					});
				} else {
					const thickness = Math.max(1, el.strokeWidth || 2);
					node = new Konva.Line({
						id: el.id,
						x: el.x,
						y: el.y,
						points: [0, 0, el.width, 0],
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked,
						stroke: el.stroke || el.fill || '#000000',
						strokeWidth: thickness,
						lineCap: 'round',
						hitStrokeWidth: Math.max(16, thickness + 12)
					});
				}
			} else if (el.type === 'image' && el.src) {
				const loaded = getCachedImage(el.src, () => syncKonva());
				if (loaded) {
					node = new Konva.Image({
						id: el.id,
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked,
						image: loaded
					});
				}
			} else if (el.type === 'signature') {
				if (el.src) {
					const loaded = getCachedImage(el.src, () => syncKonva());
					if (loaded) {
						node = new Konva.Image({
							id: el.id,
							x: el.x,
							y: el.y,
							width: el.width,
							height: el.height,
							rotation: el.rotation,
							opacity: el.opacity,
							draggable: !el.locked,
							image: loaded
						});
					}
				} else {
					const group = new Konva.Group({
						id: el.id,
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked
					});
					group.add(
						new Konva.Rect({
							x: 0,
							y: 0,
							width: el.width,
							height: el.height,
							fill: 'rgba(248, 250, 252, 0.85)',
							stroke: '#94a3b8',
							strokeWidth: 1.5,
							dash: [6, 4],
							cornerRadius: 4
						}),
						new Konva.Text({
							x: 0,
							y: 0,
							width: el.width,
							height: el.height,
							text: 'Signature\n(Draw or upload in right panel)',
							fontSize: 13,
							fontFamily: 'Inter, sans-serif',
							fill: '#64748b',
							align: 'center',
							verticalAlign: 'middle',
							lineHeight: 1.35
						})
					);
					node = group;
				}
			}

			if (!node) continue;

			node.on('mousedown tap', (evt) => {
				evt.cancelBubble = true;
				if (inlineEdit && inlineEdit.elementId !== el.id) {
					finishInlineTextEdit();
				}
				const mouseEvt = evt.evt as MouseEvent | undefined;
				const multiKey = Boolean(mouseEvt?.shiftKey || mouseEvt?.ctrlKey || mouseEvt?.metaKey);
				if (multiKey) {
					editor.selectElement(el.id, { additive: true });
				} else if (!editor.isSelected(el.id)) {
					editor.selectElement(el.id);
				}
			});

			node.on('mouseenter', () => {
				renderHoverOutline(el);
			});

			node.on('mouseleave', () => {
				clearHoverOutline();
			});

			node.on('dblclick dbltap', (evt) => {
				evt.cancelBubble = true;
				if (el.type === 'text' && !el.locked) {
					startInlineTextEdit(el);
					return;
				}
				if (el.groupId) {
					editor.selectElement(el.id, { ignoreGroup: true });
				}
			});

			node.on('dragstart', () => {
				isElementDragging = true;
				clearHoverOutline();
				const attached = transformer?.nodes() ?? [];
				if (attached.length > 1 && attached.includes(node!)) {
					const selectedIdSet = new Set(attached.map((n) => n.id()));
					let minLeft = Number.POSITIVE_INFINITY;
					let minTop = Number.POSITIVE_INFINITY;
					let maxRight = Number.NEGATIVE_INFINITY;
					let maxBottom = Number.NEGATIVE_INFINITY;

					for (const n of attached) {
						const item = editor.canvasState.elements.find((cand) => cand.id === n.id());
						if (!item) continue;
						const isLine = item.type === 'shape' && item.shapeKind === 'line';
						const isCircle = item.type === 'shape' && item.shapeKind === 'circle';
						const h = isLine ? Math.max(2, item.strokeWidth || 2) : item.height;
						const left = isCircle ? n.x() - item.width / 2 : n.x();
						const top = isCircle ? n.y() - item.height / 2 : isLine ? n.y() - h / 2 : n.y();
						minLeft = Math.min(minLeft, left);
						minTop = Math.min(minTop, top);
						maxRight = Math.max(maxRight, left + item.width);
						maxBottom = Math.max(maxBottom, top + h);
					}

					groupDragAnchor = {
						leadId: el.id,
						leadStartX: node!.x(),
						leadStartY: node!.y(),
						groupStartBox: {
							x: Number.isFinite(minLeft) ? minLeft : el.x,
							y: Number.isFinite(minTop) ? minTop : el.y,
							width: Math.max(1, maxRight - minLeft),
							height: Math.max(1, maxBottom - minTop)
						},
						selectedIdSet,
						siblings: attached
							.filter((n) => n !== node)
							.map((n) => ({ node: n, startX: n.x(), startY: n.y() }))
					};
				} else {
					groupDragAnchor = null;
				}
			});

			node.on('dragmove', (evt) => {
				if (groupDragAnchor && groupDragAnchor.leadId === el.id) {
					const rawDx = node!.x() - groupDragAnchor.leadStartX;
					const rawDy = node!.y() - groupDragAnchor.leadStartY;
					const { dx, dy } = computeGroupSnapDelta(
						groupDragAnchor.groupStartBox,
						rawDx,
						rawDy,
						groupDragAnchor.selectedIdSet,
						evt
					);
					node!.x(groupDragAnchor.leadStartX + dx);
					node!.y(groupDragAnchor.leadStartY + dy);
					for (const sib of groupDragAnchor.siblings) {
						sib.node.x(sib.startX + dx);
						sib.node.y(sib.startY + dy);
					}
					transformer?.forceUpdate();
					contentLayer?.batchDraw();
					return;
				}
				if (editor.selectedIds.length <= 1) {
					applySmartSnap(node!, el, evt);
					if (el.type === 'shape' && el.shapeKind === 'line' && syncSelectedLineHandles) {
						syncSelectedLineHandles(node as KonvaType.Line);
					}
				}
			});

			node.on('dragend', () => {
				isElementDragging = false;
				clearGuides();
				const attached = transformer?.nodes() ?? [];
				if (groupDragAnchor && groupDragAnchor.leadId === el.id && attached.length > 1) {
					groupDragAnchor = null;
					const updates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
					for (const n of attached) {
						const item = editor.canvasState.elements.find((cand) => cand.id === n.id());
						if (!item) continue;
						if (item.type === 'shape' && item.shapeKind === 'circle') {
							updates.push({
								id: item.id,
								patch: {
									x: Math.round(n.x() - item.width / 2),
									y: Math.round(n.y() - item.height / 2)
								}
							});
						} else {
							updates.push({
								id: item.id,
								patch: { x: Math.round(n.x()), y: Math.round(n.y()) }
							});
						}
					}
					editor.updateElements(updates);
					return;
				}
				groupDragAnchor = null;

				if (el.type === 'shape' && el.shapeKind === 'circle') {
					editor.updateElement(el.id, {
						x: Math.round(node!.x() - el.width / 2),
						y: Math.round(node!.y() - el.height / 2)
					});
				} else {
					editor.updateElement(el.id, {
						x: Math.round(node!.x()),
						y: Math.round(node!.y())
					});
				}
			});

			const isBeingEditedInline = Boolean(inlineEdit && inlineEdit.elementId === el.id);
			if (isBeingEditedInline) {
				node.visible(false);
			}
			contentLayer.add(node as KonvaType.Shape | KonvaType.Group);
			if (editor.isSelected(el.id) && !el.locked && !isBeingEditedInline) {
				selectedNodes.push(node);
			}
		}

		transformer.moveToTop();
		if (selectedNodes.length > 0) {
			const isSingleLine =
				selectedNodes.length === 1 &&
				editor.selectedElement?.type === 'shape' &&
				editor.selectedElement.shapeKind === 'line';
			const isSingleRaster =
				selectedNodes.length === 1 &&
				(editor.selectedElement?.type === 'image' ||
					(editor.selectedElement?.type === 'signature' && Boolean(editor.selectedElement.src)));

			if (isSingleLine && editor.selectedElement && editor.selectedElement.type === 'shape') {
				// Use dedicated draggable endpoint handles for single line elements so pulling either point
				// cleanly resizes and rotates the line in any direction without zero-height Transformer failures.
				transformer.nodes([]);
				const lineEl = editor.selectedElement;
				const lineNode = selectedNodes[0] as KonvaType.Line;
				const zoom = Math.max(0.2, editor.zoom);
				const isSmall = typeof window !== 'undefined' && window.innerWidth < LAYOUT_BREAKPOINTS.tabletMin;
				const handleRadius = (isSmall ? 8 : 6) / zoom;

				const initial = getLineEndpoints(lineEl);
				const guideLine = new Konva.Line({
					name: 'line-handle-ui',
					points: [initial.x1, initial.y1, initial.x2, initial.y2],
					stroke: '#4f46e5',
					strokeWidth: 1.5 / zoom,
					dash: [4 / zoom, 3 / zoom],
					listening: false
				});

				const startHandle = new Konva.Circle({
					name: 'line-handle-start',
					x: initial.x1,
					y: initial.y1,
					radius: handleRadius,
					fill: '#ffffff',
					stroke: '#4f46e5',
					strokeWidth: 2 / zoom,
					hitStrokeWidth: 10 / zoom,
					draggable: true
				});

				const endHandle = new Konva.Circle({
					name: 'line-handle-end',
					x: initial.x2,
					y: initial.y2,
					radius: handleRadius,
					fill: '#ffffff',
					stroke: '#4f46e5',
					strokeWidth: 2 / zoom,
					hitStrokeWidth: 10 / zoom,
					draggable: true
				});

				syncSelectedLineHandles = (activeLine: KonvaType.Line) => {
					const len = activeLine.points()[2] ?? lineEl.width;
					const pts = getLineEndpoints({
						x: activeLine.x(),
						y: activeLine.y(),
						width: len,
						rotation: activeLine.rotation()
					});
					startHandle.position({ x: pts.x1, y: pts.y1 });
					endHandle.position({ x: pts.x2, y: pts.y2 });
					guideLine.points([pts.x1, pts.y1, pts.x2, pts.y2]);
				};

				let fixedAnchor = { x: initial.x1, y: initial.y1 };
				let liveLinePatch: { x: number; y: number; width: number; rotation: number } | null = null;

				const setHandleCursor = (cursor: string) => {
					if (stage) stage.container().style.cursor = cursor;
				};

				for (const handle of [startHandle, endHandle]) {
					handle.on('mouseenter', () => setHandleCursor('grab'));
					handle.on('mouseleave', () => setHandleCursor('default'));
				}

				startHandle.on('mousedown touchstart', (evt) => {
					evt.cancelBubble = true;
				});
				endHandle.on('mousedown touchstart', (evt) => {
					evt.cancelBubble = true;
				});

				startHandle.on('dragstart', () => {
					isElementDragging = true;
					setHandleCursor('grabbing');
					fixedAnchor = { x: endHandle.x(), y: endHandle.y() };
					liveLinePatch = null;
				});

				startHandle.on('dragmove', (evt) => {
					const rawDx = fixedAnchor.x - startHandle.x();
					const rawDy = fixedAnchor.y - startHandle.y();
					const len = Math.max(16, Math.hypot(rawDx, rawDy));
					const shiftKey = Boolean((evt.evt as MouseEvent | undefined)?.shiftKey);
					const snappedDeg = snapLineAngleDeg((Math.atan2(rawDy, rawDx) * 180) / Math.PI, shiftKey);
					const rad = (snappedDeg * Math.PI) / 180;
					const sx = fixedAnchor.x - len * Math.cos(rad);
					const sy = fixedAnchor.y - len * Math.sin(rad);

					startHandle.position({ x: sx, y: sy });
					lineNode.position({ x: sx, y: sy });
					lineNode.points([0, 0, len, 0]);
					lineNode.rotation(snappedDeg);
					guideLine.points([sx, sy, fixedAnchor.x, fixedAnchor.y]);
					liveLinePatch = {
						x: Math.round(sx),
						y: Math.round(sy),
						width: Math.round(len),
						rotation: normaliseAngleDeg(snappedDeg)
					};
					contentLayer?.batchDraw();
				});

				startHandle.on('dragend', () => {
					isElementDragging = false;
					setHandleCursor('default');
					if (liveLinePatch) {
						editor.updateElement(lineEl.id, liveLinePatch);
						liveLinePatch = null;
					}
				});

				endHandle.on('dragstart', () => {
					isElementDragging = true;
					setHandleCursor('grabbing');
					fixedAnchor = { x: startHandle.x(), y: startHandle.y() };
					liveLinePatch = null;
				});

				endHandle.on('dragmove', (evt) => {
					const rawDx = endHandle.x() - fixedAnchor.x;
					const rawDy = endHandle.y() - fixedAnchor.y;
					const len = Math.max(16, Math.hypot(rawDx, rawDy));
					const shiftKey = Boolean((evt.evt as MouseEvent | undefined)?.shiftKey);
					const snappedDeg = snapLineAngleDeg((Math.atan2(rawDy, rawDx) * 180) / Math.PI, shiftKey);
					const rad = (snappedDeg * Math.PI) / 180;
					const ex = fixedAnchor.x + len * Math.cos(rad);
					const ey = fixedAnchor.y + len * Math.sin(rad);

					endHandle.position({ x: ex, y: ey });
					lineNode.position({ x: fixedAnchor.x, y: fixedAnchor.y });
					lineNode.points([0, 0, len, 0]);
					lineNode.rotation(snappedDeg);
					guideLine.points([fixedAnchor.x, fixedAnchor.y, ex, ey]);
					liveLinePatch = {
						x: Math.round(fixedAnchor.x),
						y: Math.round(fixedAnchor.y),
						width: Math.round(len),
						rotation: normaliseAngleDeg(snappedDeg)
					};
					contentLayer?.batchDraw();
				});

				endHandle.on('dragend', () => {
					isElementDragging = false;
					setHandleCursor('default');
					if (liveLinePatch) {
						editor.updateElement(lineEl.id, liveLinePatch);
						liveLinePatch = null;
					}
				});

				contentLayer.add(guideLine, startHandle, endHandle);
			} else {
				transformer.enabledAnchors([
					'top-left',
					'top-center',
					'top-right',
					'middle-right',
					'middle-left',
					'bottom-left',
					'bottom-center',
					'bottom-right'
				]);
				transformer.keepRatio(isSingleRaster);
				transformer.borderEnabled(true);
				transformer.padding(0);
				transformer.nodes(selectedNodes);
			}
		}
		contentLayer.batchDraw();
	}

	function isTextEntryTarget(target: HTMLElement | null): boolean {
		if (!target) return false;
		if (target.isContentEditable) return true;
		if (target.tagName === 'TEXTAREA') return true;
		if (target.tagName === 'INPUT') {
			const type = (target as HTMLInputElement).type.toLowerCase();
			return ['text', 'search', 'email', 'url', 'password', 'number', 'tel'].includes(type);
		}
		return false;
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		const inDialog = Boolean(target?.closest('[role="dialog"]'));

		if (mod && key === 's' && !inDialog) {
			event.preventDefault();
			onSaveShortcut?.();
			return;
		}

		// When editing directly inside a canvas text box, let native typing/selection/undo work undisturbed.
		if (inlineEdit) {
			if (event.key === 'Escape') {
				event.preventDefault();
				finishInlineTextEdit();
			}
			return;
		}

		// Global Undo / Redo work anywhere on the editor page when not inline-editing on canvas.
		if (mod && key === 'z' && !inDialog) {
			event.preventDefault();
			if (event.shiftKey) {
				editor.redo();
			} else {
				editor.undo();
			}
			return;
		}

		if (mod && key === 'y' && !inDialog) {
			event.preventDefault();
			editor.redo();
			return;
		}

		if (mod && key === 'd' && !inDialog && editor.selectedIds.length > 0) {
			event.preventDefault();
			editor.duplicateSelected();
			return;
		}

		if (mod && key === 'g' && !inDialog && editor.selectedIds.length > 0) {
			event.preventDefault();
			if (event.shiftKey) {
				editor.ungroupSelected();
			} else {
				editor.groupSelected();
			}
			return;
		}

		if (mod && event.key === '0' && !inDialog) {
			event.preventDefault();
			editor.enableAutoFitZoom();
			return;
		}

		// Preserve native typing, text copy/paste and backspace inside text fields or modal dialogs.
		if (inDialog || isTextEntryTarget(target)) return;

		if (mod && key === 'c' && editor.selectedIds.length > 0) {
			const browserSelection = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
			if (!browserSelection) {
				event.preventDefault();
				editor.copySelected();
			}
			return;
		}

		if (mod && key === 'x' && editor.selectedIds.length > 0) {
			event.preventDefault();
			editor.cutSelected();
			return;
		}

		if (mod && key === 'v' && editor.hasClipboard) {
			event.preventDefault();
			editor.pasteClipboard();
			return;
		}

		if (event.key === 'Escape' && editor.selectedIds.length > 0) {
			editor.clearSelection();
			return;
		}

		if (mod && key === 'a') {
			event.preventDefault();
			const selectable = editor.canvasState.elements
				.filter(
					(el) =>
						el.visible &&
						!el.locked &&
						!(
							el.type === 'shape' &&
							el.shapeKind !== 'line' &&
							el.width > editor.width * 0.7 &&
							el.height > editor.height * 0.7
						)
				)
				.map((el) => el.id);
			editor.selectMultiple(selectable);
			return;
		}

		// Ignore Delete/Arrow canvas nudges when focused on a <select> dropdown so arrow navigation stays native.
		if (target?.tagName === 'SELECT') return;

		const unlockedSelected = editor.selectedElements.filter((el) => !el.locked);
		if (unlockedSelected.length === 0) return;

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			editor.deleteElements(unlockedSelected.map((el) => el.id));
		} else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
			event.preventDefault();
			const step = event.shiftKey ? 10 : 1;
			const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
			const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
			editor.moveSelectedBy(dx, dy);
		}
	}

	onMount(async () => {
		const mod = await import('konva');
		Konva = mod.default;
		if (!containerEl) return;

		computeFitZoom();

		const isSmall = window.innerWidth < LAYOUT_BREAKPOINTS.tabletMin;

		stage = new Konva.Stage({
			container: containerEl,
			width: Math.round(editor.width * editor.zoom),
			height: Math.round(editor.height * editor.zoom)
		});

		bgLayer = new Konva.Layer();
		contentLayer = new Konva.Layer();
		guideLayer = new Konva.Layer({ listening: false });

		transformer = new Konva.Transformer({
			borderStroke: '#4f46e5',
			anchorStroke: '#4f46e5',
			anchorFill: '#ffffff',
			anchorSize: isSmall ? 13 : 9,
			anchorCornerRadius: 2,
			rotateAnchorOffset: 24,
			keepRatio: false,
			flipEnabled: false,
			ignoreStroke: true,
			boundBoxFunc: (oldBox, newBox) => {
				const isLineSelected =
					editor.selectedIds.length === 1 &&
					editor.selectedElement?.type === 'shape' &&
					editor.selectedElement.shapeKind === 'line';
				if (isLineSelected) {
					return Math.hypot(newBox.width, newBox.height) < 16 ? oldBox : newBox;
				}
				if (newBox.width < 20 || newBox.height < 12) return oldBox;
				return newBox;
			}
		});

		function normaliseNodeTransform(
			n: KonvaType.Node,
			el: CanvasElement,
			roundOutput: boolean
		): Partial<CanvasElement> {
			const sx = Math.abs(n.scaleX());
			const sy = Math.abs(n.scaleY());
			n.scaleX(1);
			n.scaleY(1);

			if (el.type === 'shape' && el.shapeKind === 'line') {
				const line = n as KonvaType.Line;
				const curLen = line.points()[2] ?? el.width;
				const nextLen = Math.max(16, curLen * sx);
				line.points([0, 0, nextLen, 0]);
				return {
					x: roundOutput ? Math.round(n.x()) : n.x(),
					y: roundOutput ? Math.round(n.y()) : n.y(),
					width: roundOutput ? Math.round(nextLen) : nextLen,
					rotation: roundOutput ? Math.round(n.rotation()) : n.rotation()
				};
			}

			if (el.type === 'shape' && el.shapeKind === 'circle') {
				const ellipse = n as KonvaType.Ellipse;
				const nextRX = Math.max(8, ellipse.radiusX() * sx);
				const nextRY = Math.max(8, ellipse.radiusY() * sy);
				ellipse.radiusX(nextRX);
				ellipse.radiusY(nextRY);
				const nextW = nextRX * 2;
				const nextH = nextRY * 2;
				return {
					x: roundOutput ? Math.round(ellipse.x() - nextW / 2) : ellipse.x() - nextW / 2,
					y: roundOutput ? Math.round(ellipse.y() - nextH / 2) : ellipse.y() - nextH / 2,
					width: roundOutput ? Math.round(nextW) : nextW,
					height: roundOutput ? Math.round(nextH) : nextH,
					rotation: roundOutput ? Math.round(ellipse.rotation()) : ellipse.rotation()
				};
			}

			if (el.type === 'placeholder' || el.type === 'text' || el.type === 'title') {
				// Resizing a text box changes only its geometry; stored fontSize and inline word sizes
				// remain untouched. Text shrinks visually only when the box is smaller than the text
				// and never scales above its originally given font sizes when expanded.
				const nextW = Math.max(24, (n.width() || el.width) * sx);
				const nextH = Math.max(16, (n.height() || el.height) * sy);
				n.width(nextW);
				n.height(nextH);

				return {
					x: roundOutput ? Math.round(n.x()) : n.x(),
					y: roundOutput ? Math.round(n.y()) : n.y(),
					width: roundOutput ? Math.round(nextW) : nextW,
					height: roundOutput ? Math.round(nextH) : nextH,
					rotation: roundOutput ? Math.round(n.rotation()) : n.rotation()
				};
			}

			if (el.type === 'signature' && !el.src) {
				const group = n as KonvaType.Group;
				const nextW = Math.max(40, (group.width() || el.width) * sx);
				const nextH = Math.max(24, (group.height() || el.height) * sy);
				group.width(nextW);
				group.height(nextH);
				for (const child of group.getChildren()) {
					child.width(nextW);
					child.height(nextH);
				}
				return {
					x: roundOutput ? Math.round(group.x()) : group.x(),
					y: roundOutput ? Math.round(group.y()) : group.y(),
					width: roundOutput ? Math.round(nextW) : nextW,
					height: roundOutput ? Math.round(nextH) : nextH,
					rotation: roundOutput ? Math.round(group.rotation()) : group.rotation()
				};
			}

			const baseW = n.width() || el.width;
			const baseH = n.height() || el.height;
			const nextW = Math.max(16, baseW * sx);
			const nextH = Math.max(12, baseH * sy);
			n.width(nextW);
			n.height(nextH);
			return {
				x: roundOutput ? Math.round(n.x()) : n.x(),
				y: roundOutput ? Math.round(n.y()) : n.y(),
				width: roundOutput ? Math.round(nextW) : nextW,
				height: roundOutput ? Math.round(nextH) : nextH,
				rotation: roundOutput ? Math.round(n.rotation()) : n.rotation()
			};
		}

		// Live-normalise width and height on every drag frame without mutating stored font sizes.
		transformer.on('transform', () => {
			if (!transformer) return;
			const attached = transformer.nodes();
			for (const n of attached) {
				const el = editor.canvasState.elements.find((item) => item.id === n.id());
				if (!el) continue;
				normaliseNodeTransform(n, el, false);
			}
		});

		transformer.on('transformend', () => {
			if (!transformer) return;
			const attached = transformer.nodes();
			if (attached.length === 0) return;

			const updates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
			for (const n of attached) {
				const el = editor.canvasState.elements.find((item) => item.id === n.id());
				if (!el) continue;
				updates.push({
					id: el.id,
					patch: normaliseNodeTransform(n, el, true)
				});
			}
			editor.updateElements(updates);
		});

		contentLayer.add(transformer);
		stage.add(bgLayer);
		stage.add(contentLayer);
		stage.add(guideLayer);

		// Empty-canvas click deselects; dragging on empty canvas or from the surrounding sandbox
		// draws a unified rubber-band multi-select box across the sandbox and certificate.
		stage.on('mousedown', (evt) => {
			if (evt.target !== stage && evt.target.name() !== 'canvas-bg') return;
			const mouseEvt = evt.evt as MouseEvent | undefined;
			if (!mouseEvt || mouseEvt.button !== 0) return;
			finishInlineTextEdit();
			startMarqueeSelection(
				mouseEvt.clientX,
				mouseEvt.clientY,
				Boolean(mouseEvt.shiftKey || mouseEvt.ctrlKey || mouseEvt.metaKey)
			);
		});

		stage.on('tap', (evt) => {
			if (evt.target === stage || evt.target.name() === 'canvas-bg') {
				editor.clearSelection();
			}
		});

		if (viewportEl && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				computeFitZoom();
			});
			resizeObserver.observe(viewportEl);
		}

		// Intercept Ctrl/Cmd + mouse wheel (and trackpad pinch) to zoom the sandbox instead of the browser page.
		window.addEventListener('wheel', handleCtrlWheel, { passive: false });

		if (typeof document !== 'undefined' && 'fonts' in document) {
			document.fonts.addEventListener('loadingdone', handleFontsLoaded);
		}
		preloadEditorFonts(() => syncKonva());

		syncKonva();
	});

	function handleFontsLoaded() {
		syncKonva();
	}

	$effect(() => {
		void editor.autoFitZoom;
		void editor.width;
		void editor.height;
		computeFitZoom();
	});

	$effect(() => {
		void editor.canvasState;
		void editor.width;
		void editor.height;
		void editor.selectedIds;
		void editor.zoom;
		void editor.previewMode;
		void sampleData;
		void inlineEdit;
		syncKonva();
	});

	onDestroy(() => {
		cancelMarqueeSelection();
		if (typeof window !== 'undefined') {
			window.removeEventListener('wheel', handleCtrlWheel);
		}
		if (typeof document !== 'undefined' && 'fonts' in document) {
			document.fonts.removeEventListener('loadingdone', handleFontsLoaded);
		}
		resizeObserver?.disconnect();
		stage?.destroy();
		stage = null;
	});
	let isDragOver = $state(false);
	let marqueeOverlay = $state<{ left: number; top: number; width: number; height: number } | null>(
		null
	);
	let marqueeSession: {
		startCanvasX: number;
		startCanvasY: number;
		startClientX: number;
		startClientY: number;
		active: boolean;
		additive: boolean;
		lastCanvasRect: { x: number; y: number; width: number; height: number } | null;
	} | null = null;

	function detachMarqueeWindowListeners() {
		if (typeof window === 'undefined') return;
		window.removeEventListener('pointermove', handleMarqueePointerMove);
		window.removeEventListener('pointerup', handleMarqueePointerUp);
		window.removeEventListener('pointercancel', cancelMarqueeSelection);
	}

	function cancelMarqueeSelection() {
		detachMarqueeWindowListeners();
		marqueeSession = null;
		marqueeOverlay = null;
		marqueeActiveState = false;
		clearMarqueePreviewBorders();
		guideLayer?.batchDraw();
	}

	function startMarqueeSelection(clientX: number, clientY: number, additive: boolean) {
		if (!viewportEl || !containerEl) return;
		cancelMarqueeSelection();
		const canvasRect = containerEl.getBoundingClientRect();
		marqueeSession = {
			startCanvasX: (clientX - canvasRect.left) / editor.zoom,
			startCanvasY: (clientY - canvasRect.top) / editor.zoom,
			startClientX: clientX,
			startClientY: clientY,
			active: false,
			additive,
			lastCanvasRect: null
		};
		clearHoverOutline();
		if (typeof window !== 'undefined') {
			window.addEventListener('pointermove', handleMarqueePointerMove);
			window.addEventListener('pointerup', handleMarqueePointerUp);
			window.addEventListener('pointercancel', cancelMarqueeSelection);
		}
	}

	function handleMarqueePointerMove(event: PointerEvent) {
		if (!marqueeSession || !viewportEl || !containerEl) return;
		if (
			!marqueeSession.active &&
			Math.hypot(
				event.clientX - marqueeSession.startClientX,
				event.clientY - marqueeSession.startClientY
			) < 4
		) {
			return;
		}

		marqueeSession.active = true;
		marqueeActiveState = true;

		const canvasRect = containerEl.getBoundingClientRect();
		const vpRect = viewportEl.getBoundingClientRect();
		const curCanvasX = (event.clientX - canvasRect.left) / editor.zoom;
		const curCanvasY = (event.clientY - canvasRect.top) / editor.zoom;

		const rx = Math.min(marqueeSession.startCanvasX, curCanvasX);
		const ry = Math.min(marqueeSession.startCanvasY, curCanvasY);
		const rw = Math.abs(curCanvasX - marqueeSession.startCanvasX);
		const rh = Math.abs(curCanvasY - marqueeSession.startCanvasY);
		marqueeSession.lastCanvasRect = { x: rx, y: ry, width: rw, height: rh };

		const canvasOffsetX = canvasRect.left - vpRect.left + viewportEl.scrollLeft;
		const canvasOffsetY = canvasRect.top - vpRect.top + viewportEl.scrollTop;
		marqueeOverlay = {
			left: canvasOffsetX + rx * editor.zoom,
			top: canvasOffsetY + ry * editor.zoom,
			width: rw * editor.zoom,
			height: rh * editor.zoom
		};

		const hitIds = findMarqueeHitIds(rx, ry, rw, rh);
		const previewIds = marqueeSession.additive
			? Array.from(new Set([...editor.selectedIds, ...hitIds]))
			: hitIds;
		renderMarqueePreviewBorders(previewIds);
		guideLayer?.batchDraw();
	}

	function handleMarqueePointerUp() {
		const session = marqueeSession;
		cancelMarqueeSelection();
		if (!session) return;

		if (session.active && session.lastCanvasRect) {
			const { x, y, width, height } = session.lastCanvasRect;
			const hitIds = findMarqueeHitIds(x, y, width, height);
			if (session.additive) {
				editor.selectMultiple([...editor.selectedIds, ...hitIds]);
			} else {
				editor.selectMultiple(hitIds);
			}
		} else if (!session.additive) {
			editor.clearSelection();
		}
	}

	function handleViewportPointerDown(event: PointerEvent) {
		// Clicking or dragging in the gridded sandbox outside the certificate finishes inline edits
		// and starts a rubber-band marquee selection that can sweep into the certificate.
		if (event.target !== viewportEl || event.button !== 0 || !viewportEl) return;
		const vpRect = viewportEl.getBoundingClientRect();
		if (
			event.clientX - vpRect.left > viewportEl.clientWidth ||
			event.clientY - vpRect.top > viewportEl.clientHeight
		) {
			return;
		}
		event.preventDefault();
		finishInlineTextEdit();
		startMarqueeSelection(
			event.clientX,
			event.clientY,
			Boolean(event.shiftKey || event.ctrlKey || event.metaKey)
		);
	}

	function handleCanvasDragOver(event: DragEvent) {
		const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
		if (
			!types.includes('application/x-certflow-property') &&
			!types.includes('application/x-certflow-element')
		) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		isDragOver = true;
	}

	function handleCanvasDragLeave() {
		isDragOver = false;
	}

	function handleCanvasDrop(event: DragEvent) {
		isDragOver = false;
		if (!containerEl || !event.dataTransfer) return;

		const rect = containerEl.getBoundingClientRect();
		const canvasX = (event.clientX - rect.left) / editor.zoom;
		const canvasY = (event.clientY - rect.top) / editor.zoom;

		const rawProp = event.dataTransfer.getData('application/x-certflow-property');
		if (rawProp) {
			event.preventDefault();
			try {
				const prop = JSON.parse(rawProp) as CriterionDefinition;
				editor.addPlaceholder(prop, { x: canvasX, y: canvasY });
			} catch {
				// Ignore malformed drop payload.
			}
			return;
		}

		const elementKind = event.dataTransfer.getData('application/x-certflow-element');
		if (elementKind) {
			event.preventDefault();
			if (elementKind === 'text') {
				editor.addStaticText('Certificate Text', { x: canvasX, y: canvasY });
			} else if (elementKind === 'signature') {
				editor.addSignature({ x: canvasX, y: canvasY });
			} else if (elementKind === 'rect' || elementKind === 'line' || elementKind === 'circle') {
				editor.addShape(elementKind, { x: canvasX, y: canvasY });
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	bind:this={viewportEl}
	role="presentation"
	onpointerdown={handleViewportPointerDown}
	class="editor-sandbox-grid relative flex min-h-[260px] w-full min-w-0 flex-1 p-3 sm:p-6 lg:min-h-0 {editor.autoFitZoom
		? 'overflow-hidden'
		: 'overflow-auto'} {marqueeOverlay ? 'select-none' : ''}"
>
	{#if marqueeOverlay}
		<div
			aria-hidden="true"
			style="left: {marqueeOverlay.left}px; top: {marqueeOverlay.top}px; width: {marqueeOverlay.width}px; height: {marqueeOverlay.height}px;"
			class="pointer-events-none absolute z-30 border border-dashed border-indigo-600 bg-indigo-500/12"
		></div>
	{/if}
	<div
		class="preserve-light relative m-auto shrink-0 rounded-sm bg-white shadow-md ring-2 transition {isDragOver
			? 'ring-accent'
			: 'ring-border-strong'}"
	>
		<div
			bind:this={containerEl}
			role="region"
			aria-label="Certificate canvas drop zone"
			ondragover={handleCanvasDragOver}
			ondragleave={handleCanvasDragLeave}
			ondrop={handleCanvasDrop}
			style="touch-action: none;"
		></div>

		<!-- Direct On-Canvas WYSIWYG Text Editor Overlay -->
		{#if inlineEdit && editingTextEl && editingBaseStyle}
			{@const z = editor.zoom}
			{@const vAlignCss =
				editingTextEl.verticalAlign === 'top'
					? 'flex-start'
					: editingTextEl.verticalAlign === 'bottom'
						? 'flex-end'
						: 'center'}
			<div
				style="left: {editingTextEl.x * z}px; top: {editingTextEl.y * z}px; width: {editingTextEl.width * z}px; min-height: {editingTextEl.height * z}px; transform: rotate({editingTextEl.rotation}deg); transform-origin: top left;"
				class="absolute z-20 flex flex-col"
			>
				<!-- Subtle floating edit status bar above the active text box -->
				<div
					class="pointer-events-auto absolute -top-7 left-0 flex items-center gap-2 rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-md"
				>
					<span>Editing {inlineEdit.label} · Highlight words for toolbar</span>
					<button
						type="button"
						onmousedown={(e) => e.preventDefault()}
						onclick={finishInlineTextEdit}
						class="rounded bg-white/20 px-1.5 py-0.25 font-semibold hover:bg-white/30"
					>
						Done
					</button>
				</div>

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					style="min-height: {editingTextEl.height * z}px; justify-content: {vAlignCss};"
					class="flex w-full flex-col rounded-[2px] ring-2 ring-indigo-500 ring-offset-0"
				>
					<div
						bind:this={inlineEditorEl}
						role="textbox"
						tabindex={0}
						aria-multiline="true"
						aria-label="Edit {editingTextEl.name} directly on canvas"
						contenteditable="true"
						spellcheck="false"
						style="width: 100%; font-family: {quoteFontFamily(editingTextEl.fontFamily)}, sans-serif; font-size: {(editingTextEl.fontSize * z).toFixed(2)}px; font-weight: {editingTextEl.fontWeight}; font-style: {editingTextEl.fontStyle}; text-decoration: {editingTextEl.textDecoration === 'underline' ? 'underline' : 'none'}; color: {editingTextEl.fill}; text-align: {editingTextEl.align}; line-height: {editingTextEl.lineHeight}; letter-spacing: {(editingTextEl.letterSpacing * z).toFixed(2)}px; text-transform: {editingTextEl.textTransform}; word-break: {editingTextEl.wrap === 'char' ? 'break-all' : 'normal'}; white-space: {editingTextEl.wrap === 'none' ? 'pre' : 'pre-wrap'};"
						oninput={handleInlineCanvasInput}
						onmouseup={syncInlineSelectionFromDom}
						onkeyup={syncInlineSelectionFromDom}
						onpaste={handleInlineCanvasPaste}
						onkeydown={handleInlineCanvasKeydown}
						class="w-full cursor-text bg-transparent outline-none"
					></div>
				</div>
			</div>
		{/if}
	</div>
</div>
