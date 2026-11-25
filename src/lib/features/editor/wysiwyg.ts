import { quoteFontFamily } from './fonts.ts';
import {
	parseRichTextRuns,
	type InlineFormatAction,
	type RichTextRun,
	type RichTextStyle
} from './rich-text.ts';

function stylesEqual(a: RichTextStyle, b: RichTextStyle): boolean {
	return (
		a.fontFamily.toLowerCase() === b.fontFamily.toLowerCase() &&
		Math.round(a.fontSize) === Math.round(b.fontSize) &&
		(a.fontWeight >= 600) === (b.fontWeight >= 600) &&
		a.fontStyle === b.fontStyle &&
		a.underline === b.underline &&
		a.fill.toLowerCase() === b.fill.toLowerCase()
	);
}

function mergeAdjacentRuns(runs: RichTextRun[]): RichTextRun[] {
	const merged: RichTextRun[] = [];
	for (const run of runs) {
		if (!run.text) continue;
		const prev = merged.at(-1);
		if (prev && stylesEqual(prev, run)) {
			prev.text += run.text;
		} else {
			merged.push({ ...run });
		}
	}
	return merged;
}

/**
 * Serialises styled runs back into minimal canonical CertFlow rich-text markup relative to `base`.
 * Emits inline tags only for properties that differ from the element's base style.
 */
export function serializeRichTextRuns(runs: RichTextRun[], base: RichTextStyle): string {
	const merged = mergeAdjacentRuns(runs);
	const baseBold = base.fontWeight >= 600;
	const baseItalic = base.fontStyle === 'italic';

	let out = '';
	for (const run of merged) {
		let segment = run.text;
		const isBold = run.fontWeight >= 600;
		const isItalic = run.fontStyle === 'italic';

		if (run.underline && !base.underline) {
			segment = `<u>${segment}</u>`;
		}
		if (isItalic && !baseItalic) {
			segment = segment.includes('\n') ? `<i>${segment}</i>` : `*${segment}*`;
		}
		if (isBold && !baseBold) {
			segment = `**${segment}**`;
		} else if (!isBold && baseBold) {
			segment = `<weight=400>${segment}</weight>`;
		}
		if (run.fill.toLowerCase() !== base.fill.toLowerCase()) {
			segment = `<color=${run.fill}>${segment}</color>`;
		}
		if (Math.round(run.fontSize) !== Math.round(base.fontSize)) {
			const px = Math.max(8, Math.min(240, Math.round(run.fontSize)));
			segment = `<size=${px}>${segment}</size>`;
		}
		if (run.fontFamily.trim().toLowerCase() !== base.fontFamily.trim().toLowerCase()) {
			segment = `<font=${run.fontFamily.trim()}>${segment}</font>`;
		}
		out += segment;
	}
	return out;
}

function splitRunsAtPlainRange(
	runs: RichTextRun[],
	from: number,
	to: number
): { before: RichTextRun[]; inside: RichTextRun[]; after: RichTextRun[] } {
	const before: RichTextRun[] = [];
	const inside: RichTextRun[] = [];
	const after: RichTextRun[] = [];
	let cursor = 0;

	for (const run of runs) {
		const start = cursor;
		const end = cursor + run.text.length;
		cursor = end;

		if (end <= from) {
			before.push({ ...run });
		} else if (start >= to) {
			after.push({ ...run });
		} else {
			if (start < from) {
				before.push({ ...run, text: run.text.slice(0, from - start) });
			}
			const inStart = Math.max(0, from - start);
			const inEnd = Math.min(run.text.length, to - start);
			if (inEnd > inStart) {
				inside.push({ ...run, text: run.text.slice(inStart, inEnd) });
			}
			if (end > to) {
				after.push({ ...run, text: run.text.slice(to - start) });
			}
		}
	}

	return { before, inside, after };
}

/**
 * Inspects the effective style of the highlighted plain-text range `[start, end)` inside `markup`.
 */
export function inspectPlainRangeStyle(
	markup: string,
	base: RichTextStyle,
	start: number,
	end: number
): RichTextStyle {
	const from = Math.max(0, Math.min(start, end));
	const to = Math.max(from, Math.max(start, end));
	const runs = parseRichTextRuns(markup, base);
	if (to === from) return { ...base };
	const { inside } = splitRunsAtPlainRange(runs, from, to);
	const first = inside.find((r) => r.text.length > 0);
	if (!first) return { ...base };
	return {
		fontFamily: first.fontFamily,
		fontSize: first.fontSize,
		fontWeight: first.fontWeight,
		fontStyle: first.fontStyle,
		underline: first.underline,
		fill: first.fill
	};
}

/**
 * Applies a toolbar formatting action to the plain-text character range `[start, end)` without
 * exposing or corrupting inline markup tags. Preserves exact plain-text selection offsets.
 */
export function applyFormatToPlainRange(
	markup: string,
	base: RichTextStyle,
	start: number,
	end: number,
	action: InlineFormatAction
): string {
	const from = Math.max(0, Math.min(start, end));
	const to = Math.max(from, Math.max(start, end));
	const runs = parseRichTextRuns(markup, base);

	if (to <= from) {
		if (action.kind === 'clear') {
			return runs.map((r) => r.text).join('');
		}
		return markup;
	}

	const { before, inside, after } = splitRunsAtPlainRange(runs, from, to);
	const nonEmpty = inside.filter((r) => r.text.length > 0);

	const allBold = nonEmpty.length > 0 && nonEmpty.every((r) => r.fontWeight >= 600);
	const allItalic = nonEmpty.length > 0 && nonEmpty.every((r) => r.fontStyle === 'italic');
	const allUnderline = nonEmpty.length > 0 && nonEmpty.every((r) => r.underline);

	const updatedInside = inside.map((run) => {
		if (action.kind === 'clear') {
			return { ...base, text: run.text };
		}
		if (action.kind === 'bold') {
			return { ...run, fontWeight: allBold ? 400 : 700 };
		}
		if (action.kind === 'italic') {
			return { ...run, fontStyle: allItalic ? ('normal' as const) : ('italic' as const) };
		}
		if (action.kind === 'underline') {
			return { ...run, underline: !allUnderline };
		}
		if (action.kind === 'color') {
			return { ...run, fill: action.value };
		}
		if (action.kind === 'font') {
			return { ...run, fontFamily: action.value };
		}
		if (action.kind === 'size') {
			return { ...run, fontSize: Math.max(8, Math.min(240, Math.round(action.value))) };
		}
		return run;
	});

	return serializeRichTextRuns([...before, ...updatedInside, ...after], base);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
	return escapeHtml(text).replace(/'/g, '&#39;');
}

/**
 * Converts CertFlow rich-text markup into clean WYSIWYG HTML spans for contenteditable editing.
 * Stores exact unscaled canvas styles in `data-*` attributes so DOM-to-markup round-tripping
 * is lossless across zoom levels and compact sidebar previews.
 */
export function richTextMarkupToHtml(
	markup: string,
	base: RichTextStyle,
	options?: { zoom?: number; compactSidebar?: boolean }
): string {
	const zoom = options?.zoom ?? 1;
	const compactSidebar = Boolean(options?.compactSidebar);
	const runs = parseRichTextRuns(markup, base);
	if (runs.length === 0) return '';

	let html = '';
	for (const run of runs) {
		const parts = run.text.split('\n');
		const cssParts: string[] = [];
		const dataAttrs: string[] = [];

		if (run.fontFamily.trim().toLowerCase() !== base.fontFamily.trim().toLowerCase()) {
			cssParts.push(`font-family:${quoteFontFamily(run.fontFamily)},sans-serif`);
			dataAttrs.push(`data-rf-font="${escapeAttr(run.fontFamily.trim())}"`);
		}

		if (Math.round(run.fontSize) !== Math.round(base.fontSize)) {
			const unscaled = Math.max(8, Math.min(240, Math.round(run.fontSize)));
			dataAttrs.push(`data-rf-size="${unscaled}"`);
			if (compactSidebar) {
				// Scale proportionally inside sidebar box (base ~13px) so big fonts remain legible without blowing up the card.
				const ratio = unscaled / Math.max(8, base.fontSize);
				const previewPx = Math.max(10, Math.min(24, Math.round(13 * ratio)));
				cssParts.push(`font-size:${previewPx}px`);
			} else {
				cssParts.push(`font-size:${(unscaled * zoom).toFixed(2)}px`);
			}
		}

		if ((run.fontWeight >= 600) !== (base.fontWeight >= 600)) {
			const w = run.fontWeight >= 600 ? 700 : 400;
			cssParts.push(`font-weight:${w}`);
			dataAttrs.push(`data-rf-weight="${w}"`);
		}

		if (run.fontStyle !== base.fontStyle) {
			cssParts.push(`font-style:${run.fontStyle}`);
			dataAttrs.push(`data-rf-italic="${run.fontStyle === 'italic' ? '1' : '0'}"`);
		}

		if (run.underline !== base.underline) {
			cssParts.push(`text-decoration:${run.underline ? 'underline' : 'none'}`);
			dataAttrs.push(`data-rf-underline="${run.underline ? '1' : '0'}"`);
		}

		if (run.fill.toLowerCase() !== base.fill.toLowerCase()) {
			cssParts.push(`color:${run.fill}`);
			dataAttrs.push(`data-rf-color="${escapeAttr(run.fill)}"`);
		}

		const hasAttrs = dataAttrs.length > 0;
		for (let idx = 0; idx < parts.length; idx++) {
			if (idx > 0) html += '<br>';
			const piece = parts[idx];
			if (!piece) continue;
			const escaped = escapeHtml(piece);
			if (hasAttrs) {
				html += `<span ${dataAttrs.join(' ')} style="${cssParts.join(';')}">${escaped}</span>`;
			} else {
				html += escaped;
			}
		}
	}

	if (markup.endsWith('\n')) {
		html += '<br>';
	}

	return html;
}

/**
 * Reads a contenteditable DOM tree and serialises it back to canonical CertFlow rich-text markup.
 */
export function domToRichTextMarkup(root: HTMLElement, base: RichTextStyle): string {
	const runs: RichTextRun[] = [];
	const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

	function pushText(text: string, style: RichTextStyle) {
		if (!text) return;
		const clean = text.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
		if (!clean) return;
		runs.push({ ...style, text: clean });
	}

	function walk(node: Node, inherited: RichTextStyle) {
		if (node.nodeType === Node.TEXT_NODE) {
			pushText(node.textContent ?? '', inherited);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const el = node as HTMLElement;
		const tag = el.tagName.toUpperCase();

		if (tag === 'BR') {
			pushText('\n', inherited);
			return;
		}

		const next: RichTextStyle = { ...inherited };
		if (tag === 'B' || tag === 'STRONG') next.fontWeight = 700;
		if (tag === 'I' || tag === 'EM') next.fontStyle = 'italic';
		if (tag === 'U') next.underline = true;

		const dFont = el.dataset?.rfFont;
		if (dFont) next.fontFamily = dFont;

		const dSize = el.dataset?.rfSize;
		if (dSize) {
			const parsed = Number(dSize);
			if (Number.isFinite(parsed) && parsed >= 8) next.fontSize = parsed;
		}

		const dWeight = el.dataset?.rfWeight;
		if (dWeight) {
			const parsed = Number(dWeight);
			if (Number.isFinite(parsed)) next.fontWeight = parsed;
		}

		const dItalic = el.dataset?.rfItalic;
		if (dItalic === '1') next.fontStyle = 'italic';
		else if (dItalic === '0') next.fontStyle = 'normal';

		const dUnderline = el.dataset?.rfUnderline;
		if (dUnderline === '1') next.underline = true;
		else if (dUnderline === '0') next.underline = false;

		const dColor = el.dataset?.rfColor;
		if (dColor) next.fill = dColor;

		const isBlock = el !== root && BLOCK_TAGS.has(tag);
		const hadContentBefore = runs.length > 0 && !runs.at(-1)!.text.endsWith('\n');
		if (isBlock && hadContentBefore) {
			pushText('\n', inherited);
		}

		for (const child of Array.from(el.childNodes)) {
			walk(child, next);
		}
	}

	walk(root, base);

	let result = serializeRichTextRuns(runs, base);
	// Browsers append one trailing <br> in contenteditable when ending with a newline; collapse extra empty trailing <br>.
	if (root.innerHTML.endsWith('<br><br>') && result.endsWith('\n\n')) {
		result = result.slice(0, -1);
	} else if (root.childNodes.length === 1 && root.firstChild?.nodeName === 'BR' && result === '\n') {
		result = '';
	}
	return result;
}

/**
 * Computes plain-text character offsets `{ start, end }` for the browser's current Selection inside `root`.
 */
export function getPlainTextSelection(root: HTMLElement): { start: number; end: number } | null {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return null;
	const range = sel.getRangeAt(0);
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
		return null;
	}

	function offsetForPoint(targetNode: Node, targetOffset: number): number {
		let count = 0;
		let found = false;
		const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

		function visit(node: Node) {
			if (found) return;

			if (node === targetNode) {
				if (node.nodeType === Node.TEXT_NODE) {
					count += Math.min(targetOffset, (node.textContent ?? '').length);
					found = true;
					return;
				}
				const children = Array.from(node.childNodes);
				for (let i = 0; i < Math.min(targetOffset, children.length); i++) {
					visit(children[i]);
				}
				found = true;
				return;
			}

			if (node.nodeType === Node.TEXT_NODE) {
				count += (node.textContent ?? '').length;
				return;
			}

			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement;
				const tag = el.tagName.toUpperCase();
				if (tag === 'BR') {
					count += 1;
					return;
				}
				if (el !== root && BLOCK_TAGS.has(tag) && count > 0) {
					count += 1;
				}
				for (const child of Array.from(el.childNodes)) {
					visit(child);
					if (found) return;
				}
			}
		}

		visit(root);
		return count;
	}

	const start = offsetForPoint(range.startContainer, range.startOffset);
	const end = offsetForPoint(range.endContainer, range.endOffset);
	return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Restores a browser Selection range inside `root` from plain-text character offsets `{ start, end }`.
 */
export function setPlainTextSelection(root: HTMLElement, start: number, end: number): void {
	const sel = window.getSelection();
	if (!sel) return;

	function pointForOffset(target: number): { node: Node; offset: number } {
		let remaining = Math.max(0, target);
		let result: { node: Node; offset: number } | null = null;
		const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

		function visit(node: Node) {
			if (result) return;
			if (node.nodeType === Node.TEXT_NODE) {
				const len = (node.textContent ?? '').length;
				if (remaining <= len) {
					result = { node, offset: remaining };
					return;
				}
				remaining -= len;
				return;
			}
			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement;
				const tag = el.tagName.toUpperCase();
				if (tag === 'BR') {
					if (remaining === 0) {
						const parent = el.parentNode ?? root;
						const idx = Array.from(parent.childNodes).indexOf(el);
						result = { node: parent, offset: Math.max(0, idx) };
						return;
					}
					remaining -= 1;
					if (remaining === 0) {
						const parent = el.parentNode ?? root;
						const idx = Array.from(parent.childNodes).indexOf(el);
						result = { node: parent, offset: idx + 1 };
						return;
					}
					return;
				}
				if (el !== root && BLOCK_TAGS.has(tag) && remaining > 0) {
					remaining -= 1;
				}
				for (const child of Array.from(el.childNodes)) {
					visit(child);
					if (result) return;
				}
			}
		}

		visit(root);
		return result ?? { node: root, offset: root.childNodes.length };
	}

	const startPt = pointForOffset(Math.min(start, end));
	const endPt = pointForOffset(Math.max(start, end));
	const range = document.createRange();
	try {
		range.setStart(startPt.node, startPt.offset);
		range.setEnd(endPt.node, endPt.offset);
		sel.removeAllRanges();
		sel.addRange(range);
	} catch {
		// Ignore out-of-bounds range restoration if DOM changed mid-frame.
	}
}
