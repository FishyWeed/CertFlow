import type KonvaType from 'konva';
import {
	applyTextTransform,
	buildKonvaFontStyle,
	interpolateInlineProperties,
	resolveTitleBinding,
	type TextualCanvasElement
} from './text-utils.ts';

export interface RichTextStyle {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	fontStyle: 'normal' | 'italic';
	underline: boolean;
	fill: string;
}

export interface RichTextRun extends RichTextStyle {
	text: string;
}

export interface RichTextLine {
	runs: Array<RichTextRun & { width: number }>;
	width: number;
	height: number;
	baselineOffset: number;
	ascent: number;
	descent: number;
	isParagraphEnd: boolean;
}

const RICH_MARKUP_RE =
	/\*\*[\s\S]+?\*\*|\*[^*\n]+?\*|<u>[\s\S]*?<\/u>|<b>[\s\S]*?<\/b>|<i>[\s\S]*?<\/i>|<color=[^>]+>[\s\S]*?<\/color>|<size=\d+(?:\.\d+)?>[\s\S]*?<\/size>|<font=[^>]+>[\s\S]*?<\/font>|<weight=\d+>[\s\S]*?<\/weight>/i;

export function hasRichTextMarkup(text: string): boolean {
	return RICH_MARKUP_RE.test(text);
}

export function hasElementRichText(element: TextualCanvasElement): boolean {
	if (element.type !== 'text') return false;
	if (hasRichTextMarkup(element.text)) return true;
	return Boolean(element.rules?.some((r) => hasRichTextMarkup(r.output)));
}

export function stripRichTextMarkup(text: string): string {
	return text
		.replace(/<\/?(?:b|i|u)>/gi, '')
		.replace(/<\/?(?:color|size|font|weight)(?:=[^>]*)?>/gi, '')
		.replace(/\*\*([\s\S]+?)\*\*/g, '$1')
		.replace(/\*([^*\n]+?)\*/g, '$1');
}

/**
 * Parses lightweight inline formatting tokens inside a text block into styled runs:
 * `**bold**`, `*italic*`, `<u>underline</u>`, `<color=#hex>text</color>`,
 * `<size=28>text</size>` and `<font=Great Vibes>text</font>`.
 */
export function parseRichTextRuns(input: string, base: RichTextStyle): RichTextRun[] {
	const runs: RichTextRun[] = [];

	function pushText(raw: string, style: RichTextStyle) {
		if (!raw) return;
		const prev = runs.at(-1);
		if (
			prev &&
			prev.fontFamily === style.fontFamily &&
			prev.fontSize === style.fontSize &&
			prev.fontWeight === style.fontWeight &&
			prev.fontStyle === style.fontStyle &&
			prev.underline === style.underline &&
			prev.fill === style.fill
		) {
			prev.text += raw;
		} else {
			runs.push({ ...style, text: raw });
		}
	}

	function walk(str: string, style: RichTextStyle) {
		let i = 0;
		let buf = '';

		const flush = () => {
			if (buf) {
				pushText(buf, style);
				buf = '';
			}
		};

		while (i < str.length) {
			// **bold**
			if (str.startsWith('**', i)) {
				const close = str.indexOf('**', i + 2);
				if (close > i + 2) {
					flush();
					walk(str.slice(i + 2, close), { ...style, fontWeight: 700 });
					i = close + 2;
					continue;
				}
			}

			// *italic* (single-line)
			if (str[i] === '*' && str[i + 1] !== '*') {
				const close = str.indexOf('*', i + 1);
				if (close > i + 1 && !str.slice(i + 1, close).includes('\n')) {
					flush();
					walk(str.slice(i + 1, close), { ...style, fontStyle: 'italic' });
					i = close + 1;
					continue;
				}
			}

			// <b>...</b>, <i>...</i>, <u>...</u>
			const simpleTag = str.slice(i).match(/^<(b|i|u)>/i);
			if (simpleTag) {
				const tag = simpleTag[1].toLowerCase();
				const closeTag = `</${tag}>`;
				const closeIdx = str.toLowerCase().indexOf(closeTag, i + simpleTag[0].length);
				if (closeIdx !== -1) {
					flush();
					const nextStyle: RichTextStyle =
						tag === 'b'
							? { ...style, fontWeight: 700 }
							: tag === 'i'
								? { ...style, fontStyle: 'italic' }
								: { ...style, underline: true };
					walk(str.slice(i + simpleTag[0].length, closeIdx), nextStyle);
					i = closeIdx + closeTag.length;
					continue;
				}
			}

			// <color=#hex>...</color>
			const colorTag = str.slice(i).match(/^<color=([^>]+)>/i);
			if (colorTag) {
				const closeIdx = str.toLowerCase().indexOf('</color>', i + colorTag[0].length);
				if (closeIdx !== -1) {
					flush();
					walk(str.slice(i + colorTag[0].length, closeIdx), {
						...style,
						fill: colorTag[1].trim() || style.fill
					});
					i = closeIdx + '</color>'.length;
					continue;
				}
			}

			// <size=32>...</size>
			const sizeTag = str.slice(i).match(/^<size=(\d+(?:\.\d+)?)>/i);
			if (sizeTag) {
				const closeIdx = str.toLowerCase().indexOf('</size>', i + sizeTag[0].length);
				if (closeIdx !== -1) {
					flush();
					const parsed = Number(sizeTag[1]);
					walk(str.slice(i + sizeTag[0].length, closeIdx), {
						...style,
						fontSize: Number.isFinite(parsed) ? Math.max(8, Math.min(240, parsed)) : style.fontSize
					});
					i = closeIdx + '</size>'.length;
					continue;
				}
			}

			// <font=Great Vibes>...</font>
			const fontTag = str.slice(i).match(/^<font=([^>]+)>/i);
			if (fontTag) {
				const closeIdx = str.toLowerCase().indexOf('</font>', i + fontTag[0].length);
				if (closeIdx !== -1) {
					flush();
					walk(str.slice(i + fontTag[0].length, closeIdx), {
						...style,
						fontFamily: fontTag[1].trim() || style.fontFamily
					});
					i = closeIdx + '</font>'.length;
					continue;
				}
			}

			// <weight=400>...</weight> (allows un-bolding individual words inside a bold element)
			const weightTag = str.slice(i).match(/^<weight=(\d+)>/i);
			if (weightTag) {
				const closeIdx = str.toLowerCase().indexOf('</weight>', i + weightTag[0].length);
				if (closeIdx !== -1) {
					flush();
					const parsed = Number(weightTag[1]);
					walk(str.slice(i + weightTag[0].length, closeIdx), {
						...style,
						fontWeight: Number.isFinite(parsed) ? parsed : style.fontWeight
					});
					i = closeIdx + '</weight>'.length;
					continue;
				}
			}

			buf += str[i];
			i += 1;
		}

		flush();
	}

	walk(input, base);
	return runs;
}

export type InlineFormatAction =
	| { kind: 'bold' }
	| { kind: 'italic' }
	| { kind: 'underline' }
	| { kind: 'color'; value: string }
	| { kind: 'font'; value: string }
	| { kind: 'size'; value: number }
	| { kind: 'clear' };

interface MatchedWrapper {
	kind: 'bold' | 'italic' | 'underline' | 'color' | 'font' | 'size';
	openLen: number;
	closeLen: number;
	openStart: number;
	closeStart: number;
}

function matchOuterWrapperPair(
	before: string,
	after: string
): { kind: MatchedWrapper['kind']; openLen: number; closeLen: number } | null {
	if (before.endsWith('**') && after.startsWith('**')) {
		return { kind: 'bold', openLen: 2, closeLen: 2 };
	}
	if (before.endsWith('*') && !before.endsWith('**') && after.startsWith('*') && !after.startsWith('**')) {
		return { kind: 'italic', openLen: 1, closeLen: 1 };
	}
	const simpleBefore = before.match(/<(b|i|u)>$/i);
	if (simpleBefore) {
		const tag = simpleBefore[1].toLowerCase();
		const close = `</${tag}>`;
		if (after.toLowerCase().startsWith(close)) {
			return {
				kind: tag === 'b' ? 'bold' : tag === 'i' ? 'italic' : 'underline',
				openLen: simpleBefore[0].length,
				closeLen: close.length
			};
		}
	}
	for (const kind of ['color', 'font', 'size'] as const) {
		const openMatch = before.match(new RegExp(`<${kind}=[^>]+>$`, 'i'));
		const closeMatch = after.match(new RegExp(`^</${kind}>`, 'i'));
		if (openMatch && closeMatch) {
			return { kind, openLen: openMatch[0].length, closeLen: closeMatch[0].length };
		}
	}
	return null;
}

function collectOuterWrappers(before: string, after: string): MatchedWrapper[] {
	const wrappers: MatchedWrapper[] = [];
	let b = before;
	let a = after;
	let afterOffset = 0;

	while (true) {
		const match = matchOuterWrapperPair(b, a);
		if (!match) break;
		const openStart = b.length - match.openLen;
		const closeStart = afterOffset;
		wrappers.push({
			kind: match.kind,
			openLen: match.openLen,
			closeLen: match.closeLen,
			openStart,
			closeStart
		});
		b = b.slice(0, openStart);
		a = a.slice(match.closeLen);
		afterOffset += match.closeLen;
	}
	return wrappers;
}

function matchInnerWrapperPair(
	selected: string
): { kind: MatchedWrapper['kind']; openLen: number; closeLen: number } | null {
	if (selected.startsWith('**') && selected.endsWith('**') && selected.length > 4) {
		return { kind: 'bold', openLen: 2, closeLen: 2 };
	}
	if (
		selected.startsWith('*') &&
		!selected.startsWith('**') &&
		selected.endsWith('*') &&
		!selected.endsWith('**') &&
		selected.length > 2
	) {
		return { kind: 'italic', openLen: 1, closeLen: 1 };
	}
	const simpleOpen = selected.match(/^<(b|i|u)>/i);
	if (simpleOpen) {
		const tag = simpleOpen[1].toLowerCase();
		const close = `</${tag}>`;
		if (selected.toLowerCase().endsWith(close) && selected.length > simpleOpen[0].length + close.length) {
			return {
				kind: tag === 'b' ? 'bold' : tag === 'i' ? 'italic' : 'underline',
				openLen: simpleOpen[0].length,
				closeLen: close.length
			};
		}
	}
	for (const kind of ['color', 'font', 'size'] as const) {
		const openMatch = selected.match(new RegExp(`^<${kind}=[^>]+>`, 'i'));
		const closeMatch = selected.match(new RegExp(`</${kind}>$`, 'i'));
		if (
			openMatch &&
			closeMatch &&
			selected.length > openMatch[0].length + closeMatch[0].length
		) {
			return { kind, openLen: openMatch[0].length, closeLen: closeMatch[0].length };
		}
	}
	return null;
}

/**
 * Inspects the effective rich-text style of the highlighted range inside `text` so the top
 * editor toolbar displays the highlighted words' font, size, colour, bold, italic and underline.
 */
export function inspectSelectionStyle(
	text: string,
	start: number,
	end: number,
	base: RichTextStyle
): RichTextStyle {
	const from = Math.max(0, Math.min(start, end));
	const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
	let resolved: RichTextStyle | null = null;

	function walk(str: string, offset: number, style: RichTextStyle) {
		let i = 0;
		while (i < str.length) {
			const abs = offset + i;
			if (str.startsWith('**', i)) {
				const close = str.indexOf('**', i + 2);
				if (close > i + 2) {
					walk(str.slice(i + 2, close), abs + 2, { ...style, fontWeight: 700 });
					i = close + 2;
					continue;
				}
			}
			if (str[i] === '*' && str[i + 1] !== '*') {
				const close = str.indexOf('*', i + 1);
				if (close > i + 1 && !str.slice(i + 1, close).includes('\n')) {
					walk(str.slice(i + 1, close), abs + 1, { ...style, fontStyle: 'italic' });
					i = close + 1;
					continue;
				}
			}
			const simpleTag = str.slice(i).match(/^<(b|i|u)>/i);
			if (simpleTag) {
				const tag = simpleTag[1].toLowerCase();
				const closeTag = `</${tag}>`;
				const closeIdx = str.toLowerCase().indexOf(closeTag, i + simpleTag[0].length);
				if (closeIdx !== -1) {
					const nextStyle: RichTextStyle =
						tag === 'b'
							? { ...style, fontWeight: 700 }
							: tag === 'i'
								? { ...style, fontStyle: 'italic' }
								: { ...style, underline: true };
					walk(str.slice(i + simpleTag[0].length, closeIdx), abs + simpleTag[0].length, nextStyle);
					i = closeIdx + closeTag.length;
					continue;
				}
			}
			const colorTag = str.slice(i).match(/^<color=([^>]+)>/i);
			if (colorTag) {
				const closeIdx = str.toLowerCase().indexOf('</color>', i + colorTag[0].length);
				if (closeIdx !== -1) {
					walk(str.slice(i + colorTag[0].length, closeIdx), abs + colorTag[0].length, {
						...style,
						fill: colorTag[1].trim() || style.fill
					});
					i = closeIdx + '</color>'.length;
					continue;
				}
			}
			const sizeTag = str.slice(i).match(/^<size=(\d+(?:\.\d+)?)>/i);
			if (sizeTag) {
				const closeIdx = str.toLowerCase().indexOf('</size>', i + sizeTag[0].length);
				if (closeIdx !== -1) {
					const parsed = Number(sizeTag[1]);
					walk(str.slice(i + sizeTag[0].length, closeIdx), abs + sizeTag[0].length, {
						...style,
						fontSize: Number.isFinite(parsed) ? Math.max(8, Math.min(240, parsed)) : style.fontSize
					});
					i = closeIdx + '</size>'.length;
					continue;
				}
			}
			const fontTag = str.slice(i).match(/^<font=([^>]+)>/i);
			if (fontTag) {
				const closeIdx = str.toLowerCase().indexOf('</font>', i + fontTag[0].length);
				if (closeIdx !== -1) {
					walk(str.slice(i + fontTag[0].length, closeIdx), abs + fontTag[0].length, {
						...style,
						fontFamily: fontTag[1].trim() || style.fontFamily
					});
					i = closeIdx + '</font>'.length;
					continue;
				}
			}

			if (!resolved && abs >= from && abs < to) {
				resolved = { ...style };
			}
			i += 1;
		}
	}

	walk(text, 0, base);
	return resolved ?? { ...base };
}

/**
 * Wraps or unwraps the highlighted slice of `text` with inline formatting tags,
 * returning the updated string and the adjusted selection range.
 */
export function applyInlineFormatToSelection(
	text: string,
	start: number,
	end: number,
	action: InlineFormatAction
): { text: string; selectionStart: number; selectionEnd: number } {
	const from = Math.max(0, Math.min(start, end));
	const to = Math.max(from, Math.min(text.length, Math.max(start, end)));
	const before = text.slice(0, from);
	const selected = text.slice(from, to);
	const after = text.slice(to);

	if (action.kind === 'clear') {
		if (!selected) {
			const cleaned = stripRichTextMarkup(text);
			return { text: cleaned, selectionStart: 0, selectionEnd: cleaned.length };
		}
		const outer = collectOuterWrappers(before, after);
		let nextBefore = before;
		let nextAfter = after;
		if (outer.length > 0) {
			const outermost = outer[outer.length - 1];
			nextBefore = before.slice(0, outermost.openStart);
			nextAfter = after.slice(outermost.closeStart + outermost.closeLen);
		}
		const cleaned = stripRichTextMarkup(selected);
		return {
			text: nextBefore + cleaned + nextAfter,
			selectionStart: nextBefore.length,
			selectionEnd: nextBefore.length + cleaned.length
		};
	}

	const sample = selected || 'word';
	let open = '';
	let close = '';

	if (action.kind === 'bold') {
		open = '**';
		close = '**';
	} else if (action.kind === 'italic') {
		open = '*';
		close = '*';
	} else if (action.kind === 'underline') {
		open = '<u>';
		close = '</u>';
	} else if (action.kind === 'color') {
		open = `<color=${action.value}>`;
		close = '</color>';
	} else if (action.kind === 'font') {
		open = `<font=${action.value}>`;
		close = '</font>';
	} else if (action.kind === 'size') {
		const px = Math.max(8, Math.min(240, Math.round(action.value)));
		open = `<size=${px}>`;
		close = '</size>';
	}

	// Inspect all immediately enclosing wrappers so chained edits (e.g. font -> size -> font or bold)
	// update or toggle the matching wrapper cleanly without nesting duplicate tags.
	if (selected) {
		const outerWrappers = collectOuterWrappers(before, after);
		const matchingOuter = outerWrappers.find((w) => w.kind === action.kind);

		if (matchingOuter) {
			if (action.kind === 'font' || action.kind === 'color' || action.kind === 'size') {
				const nextBefore =
					before.slice(0, matchingOuter.openStart) +
					open +
					before.slice(matchingOuter.openStart + matchingOuter.openLen);
				const nextAfter =
					after.slice(0, matchingOuter.closeStart) +
					close +
					after.slice(matchingOuter.closeStart + matchingOuter.closeLen);
				return {
					text: nextBefore + selected + nextAfter,
					selectionStart: nextBefore.length,
					selectionEnd: nextBefore.length + selected.length
				};
			}

			// Toggle off bold, italic or underline wrapper while keeping sibling wrappers intact.
			const nextBefore =
				before.slice(0, matchingOuter.openStart) +
				before.slice(matchingOuter.openStart + matchingOuter.openLen);
			const nextAfter =
				after.slice(0, matchingOuter.closeStart) +
				after.slice(matchingOuter.closeStart + matchingOuter.closeLen);
			return {
				text: nextBefore + selected + nextAfter,
				selectionStart: nextBefore.length,
				selectionEnd: nextBefore.length + selected.length
			};
		}

		// Also inspect wrappers directly inside the selected text itself.
		let innerSlice = selected;
		let innerOpenOffset = 0;
		let innerCloseOffset = 0;
		while (true) {
			const innerMatch = matchInnerWrapperPair(innerSlice);
			if (!innerMatch) break;
			if (innerMatch.kind === action.kind) {
				const prefixInSel = selected.slice(0, innerOpenOffset);
				const core = innerSlice.slice(innerMatch.openLen, innerSlice.length - innerMatch.closeLen);
				const suffixInSel = selected.slice(selected.length - innerCloseOffset);
				if (action.kind === 'font' || action.kind === 'color' || action.kind === 'size') {
					const replaced = prefixInSel + open + core + close + suffixInSel;
					return {
						text: before + replaced + after,
						selectionStart: from + prefixInSel.length + open.length,
						selectionEnd: from + prefixInSel.length + open.length + core.length
					};
				}
				const unwrapped = prefixInSel + core + suffixInSel;
				return {
					text: before + unwrapped + after,
					selectionStart: from,
					selectionEnd: from + unwrapped.length
				};
			}
			innerOpenOffset += innerMatch.openLen;
			innerCloseOffset += innerMatch.closeLen;
			innerSlice = innerSlice.slice(innerMatch.openLen, innerSlice.length - innerMatch.closeLen);
		}
	}

	const wrapped = open + sample + close;
	return {
		text: before + wrapped + after,
		selectionStart: from + open.length,
		selectionEnd: from + open.length + sample.length
	};
}

function buildCanvasFont(run: RichTextStyle, scale = 1): string {
	const style = buildKonvaFontStyle(run.fontWeight, run.fontStyle);
	const quoted = /\s/.test(run.fontFamily.trim()) ? `"${run.fontFamily.trim()}"` : run.fontFamily.trim();
	const px = Math.max(4, run.fontSize * scale);
	return `${style === 'normal' ? '' : `${style} `}${px}px ${quoted}`;
}

function measureRunText(
	ctx: CanvasRenderingContext2D,
	text: string,
	style: RichTextStyle,
	scale: number,
	letterSpacing: number
): number {
	ctx.font = buildCanvasFont(style, scale);
	const baseW = ctx.measureText(text).width;
	const extra = letterSpacing && text.length > 1 ? letterSpacing * (text.length - 1) * scale : 0;
	return baseW + extra;
}

/**
 * Splits styled runs across explicit newlines and word-wraps them to fit `maxWidth`.
 */
export function layoutRichTextLines(
	ctx: CanvasRenderingContext2D,
	runs: RichTextRun[],
	maxWidth: number,
	lineHeight: number,
	letterSpacing: number,
	wrapMode: 'word' | 'char' | 'none',
	scale = 1
): RichTextLine[] {
	const lines: RichTextLine[] = [];
	let currentRuns: Array<RichTextRun & { width: number }> = [];
	let currentWidth = 0;

	const pushLine = (isParagraphEnd: boolean) => {
		// Trim trailing whitespace width on wrapped lines for crisp centre/right/justify alignment.
		while (currentRuns.length > 0) {
			const last = currentRuns[currentRuns.length - 1];
			if (/^\s+$/.test(last.text)) {
				currentWidth -= last.width;
				currentRuns.pop();
			} else {
				const trimmed = last.text.replace(/\s+$/, '');
				if (trimmed !== last.text) {
					const newW = measureRunText(ctx, trimmed, last, scale, letterSpacing);
					currentWidth -= last.width - newW;
					last.text = trimmed;
					last.width = newW;
				}
				break;
			}
		}
		const maxFont = currentRuns.reduce((m, r) => Math.max(m, r.fontSize * scale), 12);
		let maxAscent = 0;
		let maxDescent = 0;
		for (const r of currentRuns) {
			const px = r.fontSize * scale;
			ctx.font = buildCanvasFont(r, scale);
			const sample = r.text.trim() || 'Hg';
			const metrics = ctx.measureText(sample);
			const hasActualBox =
				typeof metrics.actualBoundingBoxAscent === 'number' &&
				Number.isFinite(metrics.actualBoundingBoxAscent) &&
				metrics.actualBoundingBoxAscent > 0;
			const asc = hasActualBox ? metrics.actualBoundingBoxAscent : px * 0.72;
			const desc = hasActualBox
				? Math.max(
						0,
						typeof metrics.actualBoundingBoxDescent === 'number' &&
							Number.isFinite(metrics.actualBoundingBoxDescent)
							? metrics.actualBoundingBoxDescent
							: 0
					)
				: px * 0.18;
			maxAscent = Math.max(maxAscent, asc);
			maxDescent = Math.max(maxDescent, desc);
		}
		if (maxAscent === 0) {
			maxAscent = maxFont * 0.72;
			maxDescent = maxFont * 0.18;
		}
		const inkHeight = maxAscent + maxDescent;
		const height = Math.max(inkHeight, maxFont * Math.max(1, lineHeight || 1.2));
		// Optical vertical centre inside the line box so top gap above glyphs equals bottom gap below glyphs.
		const baselineOffset = (height + maxAscent - maxDescent) / 2;
		lines.push({
			runs: currentRuns,
			width: Math.max(0, currentWidth),
			height,
			baselineOffset,
			ascent: maxAscent,
			descent: maxDescent,
			isParagraphEnd
		});
		currentRuns = [];
		currentWidth = 0;
	};

	const appendPiece = (piece: string, style: RichTextStyle) => {
		const w = measureRunText(ctx, piece, style, scale, letterSpacing);
		const prev = currentRuns.at(-1);
		if (
			prev &&
			prev.fontFamily === style.fontFamily &&
			prev.fontSize === style.fontSize &&
			prev.fontWeight === style.fontWeight &&
			prev.fontStyle === style.fontStyle &&
			prev.underline === style.underline &&
			prev.fill === style.fill
		) {
			prev.text += piece;
			prev.width += w;
		} else {
			currentRuns.push({ ...style, text: piece, width: w });
		}
		currentWidth += w;
	};

	for (const run of runs) {
		const paragraphs = run.text.split('\n');
		for (let p = 0; p < paragraphs.length; p++) {
			if (p > 0) pushLine(true);
			const para = paragraphs[p];
			if (!para) continue;

			if (wrapMode === 'none' || maxWidth <= 0) {
				appendPiece(para, run);
				continue;
			}

			const tokens = wrapMode === 'char' ? Array.from(para) : para.split(/(\s+)/);
			for (const token of tokens) {
				if (!token) continue;
				const tokenW = measureRunText(ctx, token, run, scale, letterSpacing);
				const isSpace = /^\s+$/.test(token);
				if (currentWidth > 0 && !isSpace && currentWidth + tokenW > maxWidth) {
					pushLine(false);
				}
				if (currentWidth === 0 && isSpace) continue;
				appendPiece(token, run);
			}
		}
	}

	if (currentRuns.length > 0 || lines.length === 0) {
		pushLine(true);
	}

	return lines;
}

/**
 * Resolves any textual element's string (interpolating {{property}} tokens while preserving markup),
 * parses runs and applies the element's textTransform to each run's text.
 */
export function resolveRichTextRuns(
	element: TextualCanvasElement,
	data: Record<string, string>,
	mode: 'placeholders' | 'sample' | 'export',
	fontSizeOverride?: number
): RichTextRun[] {
	let raw = '';
	if (element.type === 'text') {
		if (mode === 'placeholders') {
			raw = element.text;
		} else {
			const baseTemplate =
				element.rules && element.rules.length > 0
					? resolveTitleBinding(element.text, element.rules, data)
					: element.text;
			raw = interpolateInlineProperties(
				baseTemplate,
				data,
				element.fallbackText,
				mode === 'sample'
			);
		}
	} else if (element.type === 'title') {
		if (mode === 'placeholders') {
			raw = `${element.defaultTitle || 'Certificate Title'} (${element.rules.length} ${element.rules.length === 1 ? 'rule' : 'rules'})`;
		} else {
			const chosen = resolveTitleBinding(element.defaultTitle, element.rules, data);
			raw = interpolateInlineProperties(chosen, data, '', mode === 'sample');
		}
	} else {
		// Legacy placeholder elements (upgraded to ordinary text when loaded in the editor).
		raw =
			mode === 'placeholders'
				? `{{${element.criterionKey}}}`
				: interpolateInlineProperties(
						`{{${element.criterionKey}}}`,
						data,
						element.fallbackText,
						mode === 'sample'
					);
	}

	const base: RichTextStyle = {
		fontFamily: element.fontFamily,
		fontSize: fontSizeOverride ?? element.fontSize,
		fontWeight: element.fontWeight,
		fontStyle: element.fontStyle,
		underline: element.textDecoration === 'underline',
		fill: element.fill
	};

	return parseRichTextRuns(raw, base).map((run) => ({
		...run,
		text: applyTextTransform(run.text, element.textTransform)
	}));
}

export interface FitRichTextLayoutOptions {
	boxWidth: number;
	boxHeight: number;
	lineHeight: number;
	letterSpacing: number;
	wrap: 'word' | 'char' | 'none';
	verticalAlign: 'top' | 'middle' | 'bottom';
	minFontSize?: number;
}

export interface FitRichTextLayoutResult {
	lines: RichTextLine[];
	scale: number;
	totalHeight: number;
	cursorY: number;
}

/**
 * Lays out styled runs inside a bounding box at their exact original font sizes (`scale = 1`).
 * Never scales text larger when the box expands; shrinks proportionally only when the box is
 * smaller than the rendered text. Computes optically centred vertical placement for `middle`.
 */
export function fitRichTextLayout(
	ctx: CanvasRenderingContext2D,
	runs: RichTextRun[],
	options: FitRichTextLayoutOptions
): FitRichTextLayoutResult {
	const { boxWidth: boxW, boxHeight: boxH, lineHeight, letterSpacing, wrap, verticalAlign } =
		options;
	const maxOriginalFont = runs.reduce((m, r) => Math.max(m, r.fontSize), 12);

	let scale = 1;
	let lines = layoutRichTextLines(ctx, runs, boxW, lineHeight, letterSpacing, wrap, scale);

	const overflowsBox = (candidateLines: RichTextLine[]) => {
		const totalH = candidateLines.reduce((sum, l) => sum + l.height, 0);
		const maxW = candidateLines.reduce((m, l) => Math.max(m, l.width), 0);
		const heightOver = boxH > 0 && totalH > boxH + 0.5;
		const widthOver = boxW > 0 && maxW > boxW + 0.5;
		return heightOver || widthOver;
	};

	if ((boxH > 0 || boxW > 0) && overflowsBox(lines)) {
		const minPx = Math.max(6, Math.min(options.minFontSize || 8, maxOriginalFont));
		const minScale = Math.max(0.12, Math.min(1, minPx / Math.max(1, maxOriginalFont)));
		while (scale > minScale && overflowsBox(lines)) {
			scale = Math.max(minScale, Number((scale - 0.03).toFixed(3)));
			lines = layoutRichTextLines(ctx, runs, boxW, lineHeight, letterSpacing, wrap, scale);
		}
	}

	const totalHeight = lines.reduce((sum, l) => sum + l.height, 0);
	let cursorY = 0;
	if (verticalAlign === 'middle') {
		if (lines.length > 0) {
			// Centre the actual visual ink bounds (top of first line's glyphs to bottom of last line's glyphs).
			const first = lines[0];
			const last = lines[lines.length - 1];
			const inkTop = first.baselineOffset - first.ascent;
			const lastLineStart = totalHeight - last.height;
			const inkBottom = lastLineStart + last.baselineOffset + last.descent;
			const inkCentre = (inkTop + inkBottom) / 2;
			cursorY = boxH / 2 - inkCentre;
		} else {
			cursorY = (boxH - totalHeight) / 2;
		}
	} else if (verticalAlign === 'bottom') {
		cursorY = boxH - totalHeight;
	}

	return { lines, scale, totalHeight, cursorY };
}

/**
 * Creates a Konva Shape that renders both plain and inline-formatted text (bold, italic, underline,
 * colour, font, size) with exact optical vertical centring and shrink-only overflow fitting (never
 * scaling text larger than its originally given font sizes when the bounding box expands).
 */
export function createRichTextKonvaNode(
	Konva: typeof KonvaType,
	el: TextualCanvasElement,
	data: Record<string, string>,
	mode: 'placeholders' | 'sample' | 'export',
	draggable: boolean
): KonvaType.Shape {
	return new Konva.Shape({
		id: el.id,
		x: el.x,
		y: el.y,
		width: el.width,
		height: el.height,
		rotation: el.rotation,
		opacity: el.opacity,
		draggable,
		sceneFunc(context, node) {
			const ctx = context._context as CanvasRenderingContext2D;
			const boxW = node.width();
			const boxH = node.height();

			const runs = resolveRichTextRuns(el, data, mode, el.fontSize);
			const layout = fitRichTextLayout(ctx, runs, {
				boxWidth: boxW,
				boxHeight: boxH,
				lineHeight: el.lineHeight,
				letterSpacing: el.letterSpacing,
				wrap: el.wrap,
				verticalAlign: el.verticalAlign,
				minFontSize: el.minFontSize
			});
			const { lines, scale } = layout;
			let cursorY = layout.cursorY;

			ctx.save();
			ctx.textBaseline = 'alphabetic';

			for (const line of lines) {
				let cursorX = 0;
				if (el.align === 'center') {
					cursorX = Math.max(0, (boxW - line.width) / 2);
				} else if (el.align === 'right') {
					cursorX = Math.max(0, boxW - line.width);
				}

				const shouldJustify = el.align === 'justify' && !line.isParagraphEnd && boxW > line.width;
				const spaceCount = shouldJustify
					? line.runs.reduce((sum, r) => sum + (r.text.match(/ /g)?.length ?? 0), 0)
					: 0;
				const extraSpacePx = spaceCount > 0 ? (boxW - line.width) / spaceCount : 0;

				const baselineY = cursorY + line.baselineOffset;

				for (const run of line.runs) {
					ctx.font = buildCanvasFont(run, scale);
					ctx.fillStyle = run.fill;
					const runStartX = cursorX;

					if (el.letterSpacing || extraSpacePx > 0) {
						let charX = cursorX;
						for (const ch of run.text) {
							ctx.fillText(ch, charX, baselineY);
							charX +=
								ctx.measureText(ch).width +
								(el.letterSpacing ? el.letterSpacing * scale : 0) +
								(ch === ' ' ? extraSpacePx : 0);
						}
						cursorX = charX;
					} else {
						ctx.fillText(run.text, cursorX, baselineY);
						cursorX += run.width;
					}

					if (run.underline && run.text.trim()) {
						const lineThickness = Math.max(1, (run.fontSize * scale) / 14);
						const underlineY = baselineY + lineThickness * 1.5;
						ctx.beginPath();
						ctx.strokeStyle = run.fill;
						ctx.lineWidth = lineThickness;
						ctx.moveTo(runStartX, underlineY);
						ctx.lineTo(cursorX, underlineY);
						ctx.stroke();
					}
				}

				cursorY += line.height;
			}

			ctx.restore();
		},
		hitFunc(context, node) {
			context.beginPath();
			context.rect(0, 0, node.width(), node.height());
			context.closePath();
			context.fillStrokeShape(node);
		}
	});
}
