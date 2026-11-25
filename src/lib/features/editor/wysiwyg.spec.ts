import { describe, expect, it } from 'vitest';
import type { RichTextStyle } from './rich-text.ts';
import {
	applyFormatToPlainRange,
	inspectPlainRangeStyle,
	richTextMarkupToHtml,
	serializeRichTextRuns
} from './wysiwyg.ts';

const base: RichTextStyle = {
	fontFamily: 'Inter',
	fontSize: 20,
	fontWeight: 400,
	fontStyle: 'normal',
	underline: false,
	fill: '#111827'
};

describe('WYSIWYG rich-text helpers', () => {
	it('formats individual words by plain-text offsets without showing or nesting markup tags', () => {
		const initial = 'For winning Champion during';
		const start = initial.indexOf('Champion');
		const end = start + 'Champion'.length;

		// Apply font, size, bold and colour sequentially using the exact same plain-text offsets.
		let markup = applyFormatToPlainRange(initial, base, start, end, {
			kind: 'font',
			value: 'Cinzel'
		});
		expect(markup).toBe('For winning <font=Cinzel>Champion</font> during');

		markup = applyFormatToPlainRange(markup, base, start, end, { kind: 'size', value: 36 });
		expect(markup).toBe('For winning <font=Cinzel><size=36>Champion</size></font> during');

		markup = applyFormatToPlainRange(markup, base, start, end, { kind: 'bold' });
		expect(markup).toBe('For winning <font=Cinzel><size=36>**Champion**</size></font> during');

		markup = applyFormatToPlainRange(markup, base, start, end, { kind: 'color', value: '#b45309' });
		expect(markup).toBe(
			'For winning <font=Cinzel><size=36><color=#b45309>**Champion**</color></size></font> during'
		);

		// Inspect reports the exact effective styles for the highlighted word.
		const style = inspectPlainRangeStyle(markup, base, start, end);
		expect(style).toEqual({
			fontFamily: 'Cinzel',
			fontSize: 36,
			fontWeight: 700,
			fontStyle: 'normal',
			underline: false,
			fill: '#b45309'
		});

		// Swapping font again updates cleanly without nesting duplicate tags.
		markup = applyFormatToPlainRange(markup, base, start, end, {
			kind: 'font',
			value: 'Great Vibes'
		});
		expect(markup).toBe(
			'For winning <font=Great Vibes><size=36><color=#b45309>**Champion**</color></size></font> during'
		);

		// Clear resets only the highlighted word back to plain text.
		markup = applyFormatToPlainRange(markup, base, start, end, { kind: 'clear' });
		expect(markup).toBe(initial);
	});

	it('renders WYSIWYG HTML with scaled zoom sizes and data attributes, hiding all markup tags', () => {
		const markup = 'Awarded to <font=Playfair Display><size=32>**Alex**</size></font>';
		const html = richTextMarkupToHtml(markup, base, { zoom: 0.5 });
		expect(html).not.toContain('<font=');
		expect(html).not.toContain('<size=');
		expect(html).not.toContain('**');
		expect(html).toContain('data-rf-font="Playfair Display"');
		expect(html).toContain('data-rf-size="32"');
		expect(html).toContain('font-size:16.00px');
		expect(html).toContain('font-weight:700');
		expect(html).toContain('>Alex</span>');
	});

	it('supports un-bolding a single word inside a bold element', () => {
		const boldBase: RichTextStyle = { ...base, fontWeight: 700 };
		const text = 'Certificate of Merit';
		const start = text.indexOf('of');
		const end = start + 2;
		const unbolded = applyFormatToPlainRange(text, boldBase, start, end, { kind: 'bold' });
		expect(unbolded).toBe('Certificate <weight=400>of</weight> Merit');
		expect(serializeRichTextRuns([{ ...boldBase, text: 'Plain' }], boldBase)).toBe('Plain');
	});
});
