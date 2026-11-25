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
}

const RICH_MARKUP_RE =
	/\*\*[\s\S]+?\*\*|\*[^*\n]+?\*|<u>[\s\S]*?<\/u>|<b>[\s\S]*?<\/b>|<i>[\s\S]*?<\/i>|<color=[^>]+>[\s\S]*?<\/color>|<size=\d+>[\s\S]*?<\/size>|<font=[^>]+>[\s\S]*?<\/font>/i;

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
		.replace(/<\/?(?:color|size|font)(?:=[^>]*)?>/gi, '')
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
		const cleaned = stripRichTextMarkup(selected);
		return {
			text: before + cleaned + after,
			selectionStart: from,
			selectionEnd: from + cleaned.length
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

	// Replace existing surrounding or enclosing parameterized tag cleanly instead of nesting duplicates.
	if (
		selected &&
		(action.kind === 'font' || action.kind === 'color' || action.kind === 'size')
	) {
		const tagName = action.kind;
		const beforeMatch = before.match(new RegExp(`<${tagName}=[^>]+>$`, 'i'));
		const afterMatch = after.match(new RegExp(`^</${tagName}>`, 'i'));
		if (beforeMatch && afterMatch) {
			const nextBefore = before.slice(0, -beforeMatch[0].length) + open;
			const nextAfter = close + after.slice(afterMatch[0].length);
			return {
				text: nextBefore + selected + nextAfter,
				selectionStart: nextBefore.length,
				selectionEnd: nextBefore.length + selected.length
			};
		}

		const innerMatch = selected.match(
			new RegExp(`^<${tagName}=[^>]+>([\\s\\S]*?)</${tagName}>$`, 'i')
		);
		if (innerMatch) {
			const inner = innerMatch[1];
			return {
				text: before + open + inner + close + after,
				selectionStart: from + open.length,
				selectionEnd: from + open.length + inner.length
			};
		}
	}

	// Toggle off when the exact surrounding delimiters already wrap the selection.
	if (
		selected &&
		(action.kind === 'bold' || action.kind === 'italic' || action.kind === 'underline')
	) {
		if (before.endsWith(open) && after.startsWith(close)) {
			const nextBefore = before.slice(0, -open.length);
			const nextAfter = after.slice(close.length);
			return {
				text: nextBefore + selected + nextAfter,
				selectionStart: nextBefore.length,
				selectionEnd: nextBefore.length + selected.length
			};
		}
		if (
			selected.startsWith(open) &&
			selected.endsWith(close) &&
			selected.length > open.length + close.length
		) {
			const unwrapped = selected.slice(open.length, -close.length);
			return {
				text: before + unwrapped + after,
				selectionStart: from,
				selectionEnd: from + unwrapped.length
			};
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
	const px = Math.max(8, run.fontSize * scale);
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

	const pushLine = () => {
		// Trim trailing whitespace width on wrapped lines for crisp centre/right alignment.
		const maxFont = currentRuns.reduce((m, r) => Math.max(m, r.fontSize * scale), 12);
		const height = maxFont * Math.max(1, lineHeight || 1.2);
		lines.push({
			runs: currentRuns,
			width: currentWidth,
			height,
			baselineOffset: maxFont * 0.82
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
			if (p > 0) pushLine();
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
					pushLine();
				}
				if (currentWidth === 0 && isSpace) continue;
				appendPiece(token, run);
			}
		}
	}

	if (currentRuns.length > 0 || lines.length === 0) {
		pushLine();
	}

	return lines;
}

/**
 * Resolves a rich-text element's string (interpolating {{property}} tokens while preserving markup),
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

/**
 * Creates a Konva Shape that renders inline-formatted rich text (bold, italic, underline, colour,
 * font) with identical layout and auto-fit behaviour in both the editor canvas and export renderer.
 */
export function createRichTextKonvaNode(
	Konva: typeof KonvaType,
	el: TextualCanvasElement,
	data: Record<string, string>,
	mode: 'placeholders' | 'sample' | 'export',
	draggable: boolean
): KonvaType.Shape {
	const shape = new Konva.Shape({
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
			const activeFontSize = (node.getAttr('richFontSize') as number | undefined) ?? el.fontSize;

			const runs = resolveRichTextRuns(el, data, mode, activeFontSize);
			let scale = 1;
			let lines = layoutRichTextLines(
				ctx,
				runs,
				boxW,
				el.lineHeight,
				el.letterSpacing,
				el.wrap,
				scale
			);

			if (el.autoFit && boxH > 0) {
				const minRatio = Math.max(8, el.minFontSize || 12) / Math.max(1, activeFontSize);
				let totalH = lines.reduce((sum, l) => sum + l.height, 0);
				while (totalH > boxH && scale > minRatio) {
					scale = Math.max(minRatio, scale - 0.05);
					lines = layoutRichTextLines(
						ctx,
						runs,
						boxW,
						el.lineHeight,
						el.letterSpacing,
						el.wrap,
						scale
					);
					totalH = lines.reduce((sum, l) => sum + l.height, 0);
				}
			}

			const totalHeight = lines.reduce((sum, l) => sum + l.height, 0);
			let cursorY = 0;
			if (el.verticalAlign === 'middle') {
				cursorY = Math.max(0, (boxH - totalHeight) / 2);
			} else if (el.verticalAlign === 'bottom') {
				cursorY = Math.max(0, boxH - totalHeight);
			}

			ctx.save();
			ctx.textBaseline = 'alphabetic';

			for (const line of lines) {
				let cursorX = 0;
				if (el.align === 'center') {
					cursorX = Math.max(0, (boxW - line.width) / 2);
				} else if (el.align === 'right') {
					cursorX = Math.max(0, boxW - line.width);
				}

				const baselineY = cursorY + line.baselineOffset;

				for (const run of line.runs) {
					ctx.font = buildCanvasFont(run, scale);
					ctx.fillStyle = run.fill;

					if (el.letterSpacing) {
						let charX = cursorX;
						for (const ch of run.text) {
							ctx.fillText(ch, charX, baselineY);
							charX += ctx.measureText(ch).width + el.letterSpacing * scale;
						}
					} else {
						ctx.fillText(run.text, cursorX, baselineY);
					}

					if (run.underline && run.text.trim()) {
						const lineThickness = Math.max(1, (run.fontSize * scale) / 14);
						const underlineY = baselineY + lineThickness * 1.5;
						ctx.beginPath();
						ctx.strokeStyle = run.fill;
						ctx.lineWidth = lineThickness;
						ctx.moveTo(cursorX, underlineY);
						ctx.lineTo(cursorX + run.width, underlineY);
						ctx.stroke();
					}

					cursorX += run.width;
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

	shape.setAttr('richFontSize', el.fontSize);
	return shape;
}
