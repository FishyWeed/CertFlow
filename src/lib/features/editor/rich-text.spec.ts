import { describe, expect, it } from 'vitest';
import {
	applyInlineFormatToSelection,
	hasRichTextMarkup,
	parseRichTextRuns,
	stripRichTextMarkup,
	type RichTextStyle
} from './rich-text.ts';

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
	});
});
