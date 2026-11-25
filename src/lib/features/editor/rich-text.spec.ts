import { describe, expect, it } from 'vitest';
import type {
	PlaceholderCanvasElement,
	StaticTextCanvasElement,
	TitleCanvasElement
} from '#lib/types/certflow.ts';
import {
	applyInlineFormatToSelection,
	fitRichTextLayout,
	hasRichTextMarkup,
	inspectSelectionStyle,
	parseRichTextRuns,
	resolveRichTextRuns,
	stripRichTextMarkup,
	type RichTextStyle
} from './rich-text.ts';

function createMockMeasureContext(): CanvasRenderingContext2D {
	let currentFont = '20px Inter';
	const parsePx = () => {
		const m = currentFont.match(/(\d+(?:\.\d+)?)px/);
		return m ? Number(m[1]) : 20;
	};
	return {
		get font() {
			return currentFont;
		},
		set font(val: string) {
			currentFont = val;
		},
		measureText(text: string) {
			const px = parsePx();
			const hasDescender = /[gjpqy]/.test(text);
			return {
				width: text.length * px * 0.55,
				actualBoundingBoxAscent: px * 0.72,
				actualBoundingBoxDescent: hasDescender ? px * 0.2 : 0
			} as TextMetrics;
		}
	} as unknown as CanvasRenderingContext2D;
}

const baseStyle: RichTextStyle = {
	fontFamily: 'Inter',
	fontSize: 20,
	fontWeight: 400,
	fontStyle: 'normal',
	underline: false,
	fill: '#0f172a'
};

describe('inline rich text formatting', () => {
	it('detects inline markup and ignores plain text', () => {
		expect(hasRichTextMarkup('Plain certificate text {{role}}')).toBe(false);
		expect(hasRichTextMarkup('Awarded to **{{name}}**')).toBe(true);
		expect(hasRichTextMarkup('With <color=#b45309>honours</color>')).toBe(true);
		expect(hasRichTextMarkup('<u>Underlined</u> word')).toBe(true);
	});

	it('parses nested bold, italic, underline and colour runs accurately', () => {
		const runs = parseRichTextRuns(
			'Awarded to **<color=#b45309>Benjamin</color>** as *<u>Champion</u>*',
			baseStyle
		);
		expect(runs).toEqual([
			{ ...baseStyle, text: 'Awarded to ' },
			{ ...baseStyle, text: 'Benjamin', fontWeight: 700, fill: '#b45309' },
			{ ...baseStyle, text: ' as ' },
			{ ...baseStyle, text: 'Champion', fontStyle: 'italic', underline: true }
		]);
	});

	it('wraps and toggles bold, underline, colour and clear on a highlighted selection', () => {
		const text = 'Awarded to {{name}} for excellence';
		const start = text.indexOf('{{name}}');
		const end = start + '{{name}}'.length;

		const bolded = applyInlineFormatToSelection(text, start, end, { kind: 'bold' });
		expect(bolded.text).toBe('Awarded to **{{name}}** for excellence');

		// Toggling bold again unwraps cleanly
		const unbolded = applyInlineFormatToSelection(
			bolded.text,
			bolded.selectionStart,
			bolded.selectionEnd,
			{ kind: 'bold' }
		);
		expect(unbolded.text).toBe(text);

		const coloured = applyInlineFormatToSelection(text, start, end, {
			kind: 'color',
			value: '#1e3a8a'
		});
		expect(coloured.text).toBe('Awarded to <color=#1e3a8a>{{name}}</color> for excellence');
		expect(stripRichTextMarkup(coloured.text)).toBe(text);
	});

	it('applies and cleanly replaces inline font and size tags on highlighted multiline text', () => {
		const text = 'as a\nParticipant\nduring';
		const start = text.indexOf('Participant');
		const end = start + 'Participant'.length;

		const fonted = applyInlineFormatToSelection(text, start, end, {
			kind: 'font',
			value: 'Great Vibes'
		});
		expect(fonted.text).toBe('as a\n<font=Great Vibes>Participant</font>\nduring');

		// Picking a second font replaces the existing <font=...> cleanly without nesting.
		const refonted = applyInlineFormatToSelection(
			fonted.text,
			fonted.selectionStart,
			fonted.selectionEnd,
			{ kind: 'font', value: 'Cinzel' }
		);
		expect(refonted.text).toBe('as a\n<font=Cinzel>Participant</font>\nduring');

		const sized = applyInlineFormatToSelection(
			refonted.text,
			refonted.selectionStart,
			refonted.selectionEnd,
			{ kind: 'size', value: 36 }
		);
		expect(sized.text).toBe('as a\n<font=Cinzel><size=36>Participant</size></font>\nduring');

		const runs = parseRichTextRuns(sized.text, baseStyle);
		expect(runs).toEqual([
			{ ...baseStyle, text: 'as a\n' },
			{ ...baseStyle, text: 'Participant', fontFamily: 'Cinzel', fontSize: 36 },
			{ ...baseStyle, text: '\nduring' }
		]);

		// Changing font again while <size=36> is nested replaces the outer <font> in place.
		const swappedFont = applyInlineFormatToSelection(
			sized.text,
			sized.selectionStart,
			sized.selectionEnd,
			{ kind: 'font', value: 'Playfair Display' }
		);
		expect(swappedFont.text).toBe(
			'as a\n<font=Playfair Display><size=36>Participant</size></font>\nduring'
		);

		// Inspecting the highlighted range reports its effective inline font and size.
		const inspected = inspectSelectionStyle(
			swappedFont.text,
			swappedFont.selectionStart,
			swappedFont.selectionEnd,
			baseStyle
		);
		expect(inspected.fontFamily).toBe('Playfair Display');
		expect(inspected.fontSize).toBe(36);
		expect(inspected.fontWeight).toBe(400);

		// Clearing formatting strips all enclosing wrappers around the highlighted word cleanly.
		const cleared = applyInlineFormatToSelection(
			swappedFont.text,
			swappedFont.selectionStart,
			swappedFont.selectionEnd,
			{ kind: 'clear' }
		);
		expect(cleared.text).toBe(text);
	});
});

describe('rich text optical vertical centring and shrink-only box fitting', () => {
	it('optically centres both mixed-case and all-caps text inside the bounding box', () => {
		const ctx = createMockMeasureContext();
		const boxHeight = 100;

		for (const sample of ['Participant', 'CHAMPION']) {
			const runs = parseRichTextRuns(sample, { ...baseStyle, fontSize: 36 });
			const layout = fitRichTextLayout(ctx, runs, {
				boxWidth: 400,
				boxHeight,
				lineHeight: 1.2,
				letterSpacing: 0,
				wrap: 'word',
				verticalAlign: 'middle'
			});

			expect(layout.scale).toBe(1);
			expect(layout.lines).toHaveLength(1);
			const line = layout.lines[0];
			const baselineY = layout.cursorY + line.baselineOffset;
			const topGap = baselineY - line.ascent;
			const bottomGap = boxHeight - (baselineY + line.descent);
			expect(topGap).toBeCloseTo(bottomGap, 5);
		}
	});

	it('never scales mixed-size text larger when the bounding box expands, and shrinks only when smaller', () => {
		const ctx = createMockMeasureContext();
		const runs = parseRichTextRuns('FOR WINNING\n<size=48>CHAMPION</size>\nDURING', {
			...baseStyle,
			fontSize: 20
		});

		// Expanding the box far beyond the text keeps scale locked at 1.0 (original given sizes).
		const largeBox = fitRichTextLayout(ctx, runs, {
			boxWidth: 900,
			boxHeight: 400,
			lineHeight: 1.2,
			letterSpacing: 0,
			wrap: 'word',
			verticalAlign: 'middle'
		});
		expect(largeBox.scale).toBe(1);
		expect(largeBox.lines).toHaveLength(3);

		// Shrinking the box smaller than the text shrinks scale proportionally below 1.0 to fit.
		const smallBox = fitRichTextLayout(ctx, runs, {
			boxWidth: 400,
			boxHeight: 60,
			lineHeight: 1.2,
			letterSpacing: 0,
			wrap: 'word',
			verticalAlign: 'middle',
			minFontSize: 8
		});
		expect(smallBox.scale).toBeLessThan(1);
		expect(smallBox.totalHeight).toBeLessThanOrEqual(60.5);
	});

	it('resolves text, legacy placeholder and legacy title elements cleanly', () => {
		const common = {
			x: 0,
			y: 0,
			width: 400,
			height: 60,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			fontFamily: 'Inter',
			fontSize: 24,
			fontWeight: 400,
			fontStyle: 'normal' as const,
			fill: '#0f172a',
			align: 'center' as const,
			verticalAlign: 'middle' as const,
			lineHeight: 1.2,
			letterSpacing: 0,
			textDecoration: '' as const,
			textTransform: 'uppercase' as const,
			wrap: 'word' as const,
			ellipsis: false,
			autoFit: true,
			minFontSize: 12
		};

		const textEl: StaticTextCanvasElement = {
			...common,
			id: 't1',
			name: 'Award',
			type: 'text',
			text: 'Awarded to **{{name}}**'
		};
		const placeholderEl: PlaceholderCanvasElement = {
			...common,
			id: 'p1',
			name: 'Name',
			type: 'placeholder',
			criterionKey: 'name',
			fallbackText: ''
		};
		const titleEl: TitleCanvasElement = {
			...common,
			id: 'ti1',
			name: 'Title',
			type: 'title',
			defaultTitle: 'Certificate of Participation',
			rules: [
				{
					id: 'r1',
					output: 'Certificate of **Achievement**',
					conditions: [{ propertyKey: 'rank', operator: 'not_empty', value: '' }]
				}
			]
		};

		const data = { name: 'Benjamin', rank: 'Champion' };
		expect(resolveRichTextRuns(textEl, data, 'export').map((r) => r.text).join('')).toBe(
			'AWARDED TO BENJAMIN'
		);
		expect(resolveRichTextRuns(placeholderEl, data, 'export')[0]?.text).toBe('BENJAMIN');
		expect(resolveRichTextRuns(titleEl, data, 'export').map((r) => r.text).join('')).toBe(
			'CERTIFICATE OF ACHIEVEMENT'
		);
	});
});
