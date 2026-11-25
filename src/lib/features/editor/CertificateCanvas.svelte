<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type KonvaType from 'konva';
	import { LAYOUT_BREAKPOINTS } from '#lib/config/layout.ts';
	import type { CanvasElement, CriterionDefinition } from '#lib/types/certflow.ts';
	import type { EditorState } from './editor-state.svelte.ts';
	import { ensureFontLoaded, extractInlineFontFamilies, preloadEditorFonts } from './fonts.ts';
	import { createRichTextKonvaNode, hasElementRichText } from './rich-text.ts';
	import { computeSnapResult, type RectBox } from './snapping.ts';
	import {
		applyAutoFit,
		buildKonvaFontStyle,
		computeScaledFontSizeForResize,
		resolveElementText
	} from './text-utils.ts';

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
				if (hasElementRichText(el)) {
					node = createRichTextKonvaNode(Konva, el, sampleData, editor.previewMode, !el.locked);
				} else {
					const textNode = new Konva.Text({
						id: el.id,
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						opacity: el.opacity,
						draggable: !el.locked,
						text: resolveElementText(el, sampleData, editor.previewMode),
						fontFamily: el.fontFamily,
						fontSize: el.fontSize,
						fontStyle: buildKonvaFontStyle(el.fontWeight, el.fontStyle),
						textDecoration: el.textDecoration,
						fill: el.fill,
						align: el.align,
						verticalAlign: el.verticalAlign,
						lineHeight: el.lineHeight,
						letterSpacing: el.letterSpacing,
						wrap: el.wrap,
						ellipsis: el.ellipsis
					});
					applyAutoFit(textNode, el);
					node = textNode;
				}
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
						stroke: el.stroke || el.fill || '#1e3a8a',
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
				const mouseEvt = evt.evt as MouseEvent | undefined;
				const multiKey = Boolean(mouseEvt?.shiftKey || mouseEvt?.ctrlKey || mouseEvt?.metaKey);
				if (multiKey) {
					editor.selectElement(el.id, { additive: true });
				} else if (!editor.isSelected(el.id)) {
					editor.selectElement(el.id);
				}
			});

			node.on('dblclick dbltap', (evt) => {
				evt.cancelBubble = true;
				if (el.groupId) {
					editor.selectElement(el.id, { ignoreGroup: true });
				}
			});

			node.on('dragstart', () => {
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
				}
			});

			node.on('dragend', () => {
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

			contentLayer.add(node as KonvaType.Shape | KonvaType.Group);
			if (editor.isSelected(el.id) && !el.locked) {
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
			transformer.enabledAnchors(
				isSingleLine
					? ['middle-left', 'middle-right']
					: [
							'top-left',
							'top-center',
							'top-right',
							'middle-right',
							'middle-left',
							'bottom-left',
							'bottom-center',
							'bottom-right'
						]
			);
			transformer.keepRatio(isSingleRaster);
			transformer.borderEnabled(!isSingleLine);
			transformer.padding(isSingleLine ? 4 : 0);
			transformer.nodes(selectedNodes);
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

		// Global Undo / Redo / Save work anywhere on the editor page without clicking the canvas first.
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

		if (mod && key === 's' && !inDialog) {
			event.preventDefault();
			onSaveShortcut?.();
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

		// Snapshot initial dimensions & font sizes at transformstart so scaling stays drift-free.
		const transformStartMeta = new Map<string, { fontSize: number; width: number; height: number }>();

		transformer.on('transformstart', () => {
			transformStartMeta.clear();
			if (!transformer) return;
			for (const n of transformer.nodes()) {
				const el = editor.canvasState.elements.find((item) => item.id === n.id());
				if (!el) continue;
				if (el.type === 'placeholder' || el.type === 'text' || el.type === 'title') {
					transformStartMeta.set(el.id, {
						fontSize: el.fontSize,
						width: el.width,
						height: el.height
					});
				}
			}
		});

		function normaliseNodeTransform(
			n: KonvaType.Node,
			el: CanvasElement,
			roundOutput: boolean,
			activeAnchor: string,
			isGroupResize: boolean
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
				const start = transformStartMeta.get(el.id) ?? {
					fontSize: el.fontSize,
					width: el.width,
					height: el.height
				};

				const nextW = Math.max(24, (n.width() || el.width) * sx);
				const nextH = Math.max(16, (n.height() || el.height) * sy);
				n.width(nextW);
				n.height(nextH);

				const scaledFont = computeScaledFontSizeForResize(
					start,
					{ width: nextW, height: nextH },
					activeAnchor,
					isGroupResize
				);

				let targetFont = scaledFont ?? start.fontSize;

				if (Konva && n instanceof Konva.Text) {
					if (scaledFont === null) {
						// Horizontal side resize: shrink fontSize automatically if the narrower box causes overflow.
						n.fontSize(targetFont);
						n.height(undefined as unknown as number);
						while (targetFont > 8 && n.height() > nextH) {
							targetFont -= 1;
							n.fontSize(targetFont);
						}
						n.height(nextH);
					} else {
						const applied = roundOutput ? Math.round(targetFont) : targetFont;
						n.fontSize(applied);
						applyAutoFit(n, { ...el, width: nextW, height: nextH, fontSize: applied });
						targetFont = n.fontSize();
					}
				} else {
					const applied = roundOutput ? Math.round(targetFont) : targetFont;
					n.setAttr('richFontSize', applied);
				}

				const committedFont = Math.max(8, Math.min(240, Math.round(targetFont)));
				return {
					x: roundOutput ? Math.round(n.x()) : n.x(),
					y: roundOutput ? Math.round(n.y()) : n.y(),
					width: roundOutput ? Math.round(nextW) : nextW,
					height: roundOutput ? Math.round(nextH) : nextH,
					rotation: roundOutput ? Math.round(n.rotation()) : n.rotation(),
					fontSize: committedFont
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

		// Live-normalise width/height/fontSize on every drag frame so text stays crisp and scales with the box.
		transformer.on('transform', () => {
			if (!transformer) return;
			const attached = transformer.nodes();
			const activeAnchor = transformer.getActiveAnchor() ?? '';
			const isGroupResize = attached.length > 1;
			for (const n of attached) {
				const el = editor.canvasState.elements.find((item) => item.id === n.id());
				if (!el) continue;
				normaliseNodeTransform(n, el, false, activeAnchor, isGroupResize);
			}
		});

		transformer.on('transformend', () => {
			if (!transformer) return;
			const attached = transformer.nodes();
			if (attached.length === 0) return;

			const activeAnchor = transformer.getActiveAnchor() ?? '';
			const isGroupResize = attached.length > 1;
			const updates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
			for (const n of attached) {
				const el = editor.canvasState.elements.find((item) => item.id === n.id());
				if (!el) continue;
				updates.push({
					id: el.id,
					patch: normaliseNodeTransform(n, el, true, activeAnchor, isGroupResize)
				});
			}
			transformStartMeta.clear();
			editor.updateElements(updates);
		});

		contentLayer.add(transformer);
		stage.add(bgLayer);
		stage.add(contentLayer);
		stage.add(guideLayer);

		// Empty-canvas click deselects; dragging on empty canvas draws a rubber-band multi-select box.
		let marqueeStart: { x: number; y: number } | null = null;
		let marqueeActive = false;
		let marqueeRect: KonvaType.Rect | null = null;
		let marqueeAdditive = false;

		stage.on('mousedown', (evt) => {
			if (evt.target !== stage && evt.target.name() !== 'canvas-bg') return;
			const pos = stage?.getPointerPosition();
			if (!pos) return;
			const mouseEvt = evt.evt as MouseEvent | undefined;
			marqueeAdditive = Boolean(mouseEvt?.shiftKey || mouseEvt?.ctrlKey || mouseEvt?.metaKey);
			marqueeStart = { x: pos.x / editor.zoom, y: pos.y / editor.zoom };
			marqueeActive = false;
		});

		stage.on('mousemove', () => {
			if (!marqueeStart || !Konva || !guideLayer || !stage) return;
			const pos = stage.getPointerPosition();
			if (!pos) return;
			const cx = pos.x / editor.zoom;
			const cy = pos.y / editor.zoom;
			if (!marqueeActive && Math.hypot(cx - marqueeStart.x, cy - marqueeStart.y) < 4) return;

			marqueeActive = true;
			const rx = Math.min(marqueeStart.x, cx);
			const ry = Math.min(marqueeStart.y, cy);
			const rw = Math.abs(cx - marqueeStart.x);
			const rh = Math.abs(cy - marqueeStart.y);

			if (!marqueeRect) {
				marqueeRect = new Konva.Rect({
					x: rx,
					y: ry,
					width: rw,
					height: rh,
					fill: 'rgba(79, 70, 229, 0.12)',
					stroke: '#4f46e5',
					strokeWidth: 1,
					dash: [4, 3]
				});
				guideLayer.add(marqueeRect);
			} else {
				marqueeRect.setAttrs({ x: rx, y: ry, width: rw, height: rh });
			}
			guideLayer.batchDraw();
		});

		stage.on('mouseup', () => {
			if (!marqueeStart) return;
			if (marqueeActive && marqueeRect) {
				const rx = marqueeRect.x();
				const ry = marqueeRect.y();
				const rw = marqueeRect.width();
				const rh = marqueeRect.height();

				const hitIds = editor.canvasState.elements
					.filter((el) => {
						if (!el.visible || el.locked) return false;
						const isFrame =
							el.type === 'shape' &&
							el.shapeKind !== 'line' &&
							el.width > editor.width * 0.7 &&
							el.height > editor.height * 0.7;
						if (isFrame) return false;
						const isLine = el.type === 'shape' && el.shapeKind === 'line';
						const elH = isLine ? Math.max(4, el.strokeWidth || 2) : el.height;
						const elY = isLine ? el.y - elH / 2 : el.y;
						return el.x < rx + rw && el.x + el.width > rx && elY < ry + rh && elY + elH > ry;
					})
					.map((el) => el.id);

				if (marqueeAdditive) {
					editor.selectMultiple([...editor.selectedIds, ...hitIds]);
				} else {
					editor.selectMultiple(hitIds);
				}
			} else if (!marqueeAdditive) {
				editor.clearSelection();
			}

			marqueeStart = null;
			marqueeActive = false;
			marqueeRect?.destroy();
			marqueeRect = null;
			guideLayer?.batchDraw();
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
		syncKonva();
	});

	onDestroy(() => {
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

	function handleViewportPointerDown(event: PointerEvent) {
		// Clicking the grey sandbox area surrounding the certificate deselects active elements.
		if (event.target === viewportEl) {
			editor.clearSelection();
		}
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
	class="relative flex min-h-[260px] w-full min-w-0 flex-1 bg-surface-subtle p-3 sm:p-6 lg:min-h-0 {editor.autoFitZoom
		? 'overflow-hidden'
		: 'overflow-auto'}"
>
	<div
		bind:this={containerEl}
		role="region"
		aria-label="Certificate canvas drop zone"
		ondragover={handleCanvasDragOver}
		ondragleave={handleCanvasDragLeave}
		ondrop={handleCanvasDrop}
		style="touch-action: none;"
		class="m-auto shrink-0 rounded-sm bg-white shadow-md ring-2 transition {isDragOver
			? 'ring-accent'
			: 'ring-border-strong'}"
	></div>
</div>
