import type Konva from 'konva';
import type {
	PlaceholderCanvasElement,
	StaticTextCanvasElement,
	TextTransformMode,
	TitleBindingRule,
	TitleCanvasElement
} from '#lib/types/certflow.ts';

export type TextualCanvasElement =
	| PlaceholderCanvasElement
	| StaticTextCanvasElement
	| TitleCanvasElement;

export function applyTextTransform(value: string, mode: TextTransformMode): string {
	switch (mode) {
		case 'uppercase':
			return value.toUpperCase();
		case 'lowercase':
			return value.toLowerCase();
		case 'capitalize':
			return value.replace(/\b\w/g, (char) => char.toUpperCase());
		default:
			return value;
	}
}

function lookupPropertyValue(data: Record<string, string>, key: string): string {
	const direct = (data[key] ?? '').trim();
	if (direct) return direct;
	// Keep {{rank}} and legacy {{ranking}} interchangeable so older templates keep working.
	if (key === 'rank') return (data.ranking ?? '').trim();
	if (key === 'ranking') return (data.rank ?? '').trim();
	return '';
}

/**
 * Replaces `{{propertyKey}}` tokens inside a text block with live property values.
 * If a property value is empty, uses `fallbackText` when set; otherwise keeps the token in preview
 * or outputs an empty string on final export.
 */
export function interpolateInlineProperties(
	template: string,
	data: Record<string, string>,
	fallbackText?: string,
	keepTokenWhenEmpty = true
): string {
	const fallback = (fallbackText ?? '').trim();
	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
		const val = lookupPropertyValue(data, key);
		if (val) return val;
		if (fallback) return fallback;
		return keepTokenWhenEmpty ? match : '';
	});
}

/**
 * Evaluates a Title element's conditional binding table against a recipient's property map.
 * All conditions inside a rule use AND logic; the most specific matching rule wins
 * (for example, Role = Participant AND Rank not empty beats Role = Participant alone).
 */
export function resolveTitleBinding(
	defaultTitle: string,
	rules: TitleBindingRule[],
	data: Record<string, string>
): string {
	let bestOutput: string | null = null;
	let bestScore = -1;

	for (const rule of rules) {
		const output = rule.output.trim();
		if (!output || rule.conditions.length === 0) continue;

		let allMatched = true;
		let score = 0;

		for (const cond of rule.conditions) {
			const cellVal = lookupPropertyValue(data, cond.propertyKey);
			if (cond.operator === 'not_empty') {
				if (!cellVal) {
					allMatched = false;
					break;
				}
				score += 2;
			} else if (cond.operator === 'is_empty') {
				if (cellVal) {
					allMatched = false;
					break;
				}
				score += 2;
			} else {
				const target = cond.value.trim().toLowerCase();
				if (!target || cellVal.toLowerCase() !== target) {
					allMatched = false;
					break;
				}
				score += 3;
			}
		}

		if (allMatched && score > bestScore) {
			bestScore = score;
			bestOutput = output;
		}
	}

	return bestOutput ?? defaultTitle;
}

/**
 * Resolves the string shown on canvas or during export.
 * All text elements support `{{property}}` tokens with an optional editable default value when empty.
 */
export function resolveElementText(
	element: TextualCanvasElement,
	data: Record<string, string>,
	mode: 'placeholders' | 'sample' | 'export'
): string {
	if (element.type === 'title') {
		if (mode === 'placeholders') {
			return applyTextTransform(
				`${element.defaultTitle || 'Certificate Title'} (${element.rules.length} ${element.rules.length === 1 ? 'rule' : 'rules'})`,
				element.textTransform
			);
		}
		const chosen = resolveTitleBinding(element.defaultTitle, element.rules, data);
		const interpolated = interpolateInlineProperties(chosen, data, '', mode === 'sample');
		return applyTextTransform(interpolated, element.textTransform);
	}

	if (element.type === 'text') {
		if (mode === 'placeholders') {
			return applyTextTransform(element.text, element.textTransform);
		}
		const baseTemplate =
			element.rules && element.rules.length > 0
				? resolveTitleBinding(element.text, element.rules, data)
				: element.text;
		const content = interpolateInlineProperties(
			baseTemplate,
			data,
			element.fallbackText,
			mode === 'sample'
		);
		return applyTextTransform(content, element.textTransform);
	}

	// Legacy placeholder elements (upgraded to ordinary text when loaded in the editor).
	if (mode === 'placeholders') {
		return `{{${element.criterionKey}}}`;
	}

	const rawValue = lookupPropertyValue(data, element.criterionKey);
	const fallback = (element.fallbackText ?? '').trim();
	const displayText =
		rawValue || fallback || (mode === 'sample' ? `{{${element.criterionKey}}}` : '');

	return applyTextTransform(displayText, element.textTransform);
}

export function buildKonvaFontStyle(fontWeight: number, fontStyle: 'normal' | 'italic'): string {
	const bold = fontWeight >= 600;
	if (bold && fontStyle === 'italic') return 'italic bold';
	if (bold) return 'bold';
	if (fontStyle === 'italic') return 'italic';
	return 'normal';
}

/**
 * Shrinks a Konva Text node's fontSize until its wrapped height fits within the
 * element's bounding box height. Prevents long participant names from clipping.
 */
export function applyAutoFit(node: Konva.Text, element: TextualCanvasElement): void {
	node.fontSize(element.fontSize);
	if (!element.autoFit || element.height <= 0) {
		return;
	}

	let currentSize = element.fontSize;
	const minSize = Math.max(8, element.minFontSize || 12);

	// Temporarily clear fixed height to measure natural wrapped height at current fontSize.
	node.height(undefined as unknown as number);
	while (currentSize > minSize && node.height() > element.height) {
		currentSize -= 1;
		node.fontSize(currentSize);
	}
	node.height(element.height);
}

export interface TextBoxGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
}

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

function keepCentred(
	prev: TextBoxGeometry,
	nextWidth: number,
	nextHeight: number,
	canvas: { width: number; height: number }
): TextBoxGeometry {
	const width = clamp(Math.round(nextWidth), 40, Math.max(40, canvas.width));
	const height = clamp(Math.round(nextHeight), 16, Math.max(16, canvas.height));
	const cx = prev.x + prev.width / 2;
	const cy = prev.y + prev.height / 2;
	const x = clamp(Math.round(cx - width / 2), 0, Math.max(0, canvas.width - width));
	const y = clamp(Math.round(cy - height / 2), 0, Math.max(0, canvas.height - height));
	return { x, y, width, height };
}

/**
 * Proportionally scales a text element's bounding box around its centre when fontSize changes.
 */
export function scaleBoxForFontSizeChange(
	prev: TextBoxGeometry,
	prevFontSize: number,
	nextFontSize: number,
	lineHeight: number,
	canvas: { width: number; height: number }
): TextBoxGeometry {
	const safePrev = Math.max(1, prevFontSize);
	const ratio = nextFontSize / safePrev;
	const minHeight = Math.round(nextFontSize * Math.max(1, lineHeight || 1.2) * 1.15);
	const nextWidth = prev.width * ratio;
	const nextHeight = Math.max(minHeight, prev.height * ratio);
	return keepCentred(prev, nextWidth, nextHeight, canvas);
}

export interface MeasuredFontMetrics {
	width: number;
	height: number;
}

function measureTextInBrowser(
	text: string,
	fontFamily: string,
	fontSize: number,
	fontWeight: number,
	fontStyle: 'normal' | 'italic',
	lineHeight: number
): MeasuredFontMetrics | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const quoted = /\s/.test(fontFamily.trim()) ? `"${fontFamily.trim()}"` : fontFamily.trim();
	const style = buildKonvaFontStyle(fontWeight, fontStyle);
	ctx.font = `${style === 'normal' ? '' : `${style} `}${fontSize}px ${quoted}`;

	const lines = (text || 'Sample Text').split('\n');
	let maxW = 0;
	let maxLineH = fontSize * Math.max(1, lineHeight || 1.2);
	for (const line of lines) {
		const m = ctx.measureText(line || 'Aa');
		maxW = Math.max(maxW, m.width);
		const ascent = m.actualBoundingBoxAscent ?? 0;
		const descent = m.actualBoundingBoxDescent ?? 0;
		if (ascent + descent > 0) {
			maxLineH = Math.max(maxLineH, (ascent + descent) * 1.35);
		}
	}
	return {
		width: Math.max(20, maxW),
		height: Math.max(16, maxLineH * lines.length)
	};
}

/**
 * Scales a text element's bounding box to fit a newly selected font family without clipping
 * or squashing taller/wider typefaces (such as Great Vibes or Cinzel).
 */
export function scaleBoxForFontFamilyChange(
	prev: TextBoxGeometry,
	text: string,
	prevFontFamily: string,
	nextFontFamily: string,
	fontSize: number,
	fontWeight: number,
	fontStyle: 'normal' | 'italic',
	lineHeight: number,
	canvas: { width: number; height: number },
	measureFn: typeof measureTextInBrowser = measureTextInBrowser
): TextBoxGeometry {
	const oldMetrics = measureFn(text, prevFontFamily, fontSize, fontWeight, fontStyle, lineHeight);
	const newMetrics = measureFn(text, nextFontFamily, fontSize, fontWeight, fontStyle, lineHeight);
	if (!oldMetrics || !newMetrics) return { ...prev };

	const widthRatio = clamp(newMetrics.width / Math.max(1, oldMetrics.width), 0.6, 2.2);
	const heightRatio = clamp(newMetrics.height / Math.max(1, oldMetrics.height), 0.6, 2.2);
	const nextWidth = Math.max(prev.width * widthRatio, newMetrics.width + 24);
	const nextHeight = Math.max(prev.height * heightRatio, newMetrics.height + 8);
	return keepCentred(prev, nextWidth, nextHeight, canvas);
}

/**
 * Computes the proportional font size when resizing a text element with Transformer handles.
 * Returns `null` for horizontal-only side handles so width wrapping stays flexible unless text overflows.
 */
export function computeScaledFontSizeForResize(
	start: { fontSize: number; width: number; height: number },
	next: { width: number; height: number },
	activeAnchor: string,
	isGroupResize = false
): number | null {
	const scaleW = next.width / Math.max(1, start.width);
	const scaleH = next.height / Math.max(1, start.height);

	if (activeAnchor === 'middle-left' || activeAnchor === 'middle-right') {
		return null;
	}

	if (activeAnchor === 'top-center' || activeAnchor === 'bottom-center') {
		return clamp(start.fontSize * scaleH, 8, 240);
	}

	// Corner handles or multi-element group resize scale the font along with the box.
	if (
		isGroupResize ||
		activeAnchor === 'top-left' ||
		activeAnchor === 'top-right' ||
		activeAnchor === 'bottom-left' ||
		activeAnchor === 'bottom-right' ||
		activeAnchor === ''
	) {
		const ratio = scaleW < 1 || scaleH < 1 ? Math.min(scaleW, scaleH) : Math.sqrt(scaleW * scaleH);
		return clamp(start.fontSize * ratio, 8, 240);
	}

	return clamp(start.fontSize * scaleH, 8, 240);
}
