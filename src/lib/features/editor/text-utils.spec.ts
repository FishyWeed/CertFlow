import { describe, expect, it } from 'vitest';
import type { PlaceholderCanvasElement } from '#lib/types/certflow.ts';
import {
	applyTextTransform,
	buildKonvaFontStyle,
	computeScaledFontSizeForResize,
	resolveElementText,
	resolveTitleBinding,
	scaleBoxForFontFamilyChange,
	scaleBoxForFontSizeChange
} from './text-utils.ts';

const basePlaceholder: PlaceholderCanvasElement = {
	id: 'ph-1',
	name: 'Ranking',
	type: 'placeholder',
	criterionKey: 'ranking',
	fallbackText: 'Certificate of Participation',
	x: 0,
	y: 0,
	width: 500,
	height: 60,
	rotation: 0,
	opacity: 1,
	visible: true,
	locked: false,
	fontFamily: 'Georgia',
	fontSize: 32,
	fontWeight: 700,
	fontStyle: 'normal',
	textDecoration: '',
	textTransform: 'uppercase',
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

describe('editor text utilities', () => {
	it('shows token format in placeholder mode', () => {
		expect(resolveElementText(basePlaceholder, { ranking: 'Champion' }, 'placeholders')).toBe(
			'{{ranking}}'
		);
	});

	it('falls back to Certificate of Participation when ranking is empty', () => {
		expect(resolveElementText(basePlaceholder, { ranking: '' }, 'sample')).toBe(
			'CERTIFICATE OF PARTICIPATION'
		);
	});

	it('prints custom ranking cleanly with transform and zero hidden extra words', () => {
		const titled: PlaceholderCanvasElement = {
			...basePlaceholder,
			textTransform: 'capitalize'
		};
		expect(resolveElementText(titled, { ranking: '1st runner up' }, 'sample')).toBe(
			'1st Runner Up'
		);
	});

	it('interpolates inline {{property}} tokens inside normal text elements', () => {
		const textEl = {
			...basePlaceholder,
			type: 'text' as const,
			text: 'Awarded to {{name}} as {{role}}',
			textTransform: 'none' as const
		};
		expect(resolveElementText(textEl, { name: 'Benjamin', role: 'Participant' }, 'placeholders')).toBe(
			'Awarded to {{name}} as {{role}}'
		);
		expect(resolveElementText(textEl, { name: 'Benjamin', role: 'Participant' }, 'sample')).toBe(
			'Awarded to Benjamin as Participant'
		);
	});

	it('uses the editable default value when {{rank}} is empty and overrides it when filled', () => {
		const rankTextEl = {
			...basePlaceholder,
			type: 'text' as const,
			text: '{{rank}}',
			fallbackText: 'Certificate of Participation',
			textTransform: 'uppercase' as const
		};
		expect(resolveElementText(rankTextEl, { rank: '' }, 'sample')).toBe(
			'CERTIFICATE OF PARTICIPATION'
		);
		expect(resolveElementText(rankTextEl, { rank: 'Champion' }, 'sample')).toBe('CHAMPION');
		expect(resolveElementText(rankTextEl, { rank: '' }, 'export')).toBe(
			'CERTIFICATE OF PARTICIPATION'
		);
		expect(resolveElementText(rankTextEl, { rank: '1st Runner Up' }, 'export')).toBe(
			'1ST RUNNER UP'
		);
	});

	it('maps numeric font weight and italic style to Konva fontStyle', () => {
		expect(buildKonvaFontStyle(400, 'normal')).toBe('normal');
		expect(buildKonvaFontStyle(700, 'normal')).toBe('bold');
		expect(buildKonvaFontStyle(400, 'italic')).toBe('italic');
		expect(buildKonvaFontStyle(700, 'italic')).toBe('italic bold');
	});

	it('transforms text casing consistently', () => {
		expect(applyTextTransform('hello world', 'capitalize')).toBe('Hello World');
		expect(applyTextTransform('Hello', 'lowercase')).toBe('hello');
	});

	it('scales the text box proportionally around its centre when font size changes', () => {
		const box = { x: 200, y: 200, width: 400, height: 60 };
		const grown = scaleBoxForFontSizeChange(box, 30, 60, 1.2, { width: 1123, height: 794 });
		expect(grown.width).toBe(800);
		expect(grown.height).toBe(120);
		// Centre stays at (400, 230)
		expect(grown.x + grown.width / 2).toBe(400);
		expect(grown.y + grown.height / 2).toBe(230);

		const shrunk = scaleBoxForFontSizeChange(box, 30, 15, 1.2, { width: 1123, height: 794 });
		expect(shrunk.width).toBe(200);
		expect(shrunk.height).toBe(30);
	});

	it('scales the text box to fit a taller or wider font family', () => {
		const box = { x: 200, y: 200, width: 300, height: 50 };
		const mockMeasure = (_t: string, family: string) =>
			family === 'Great Vibes' ? { width: 420, height: 75 } : { width: 280, height: 45 };
		const next = scaleBoxForFontFamilyChange(
			box,
			'Participant',
			'Inter',
			'Great Vibes',
			36,
			400,
			'normal',
			1.2,
			{ width: 1123, height: 794 },
			mockMeasure
		);
		expect(next.width).toBeGreaterThan(box.width);
		expect(next.height).toBeGreaterThan(box.height);
	});

	it('scales font size down and up when resizing a text element from corner or vertical handles', () => {
		const start = { fontSize: 40, width: 400, height: 80 };
		// Shrinking corner to half size scales font size to 20
		expect(
			computeScaledFontSizeForResize(start, { width: 200, height: 40 }, 'bottom-right', false)
		).toBe(20);
		// Scaling top/bottom handle down to 75% scales font size to 30
		expect(
			computeScaledFontSizeForResize(start, { width: 400, height: 60 }, 'bottom-center', false)
		).toBe(30);
		// Horizontal side handle returns null so wrapping stays flexible unless text overflows
		expect(
			computeScaledFontSizeForResize(start, { width: 250, height: 80 }, 'middle-right', false)
		).toBeNull();
	});

	it('resolves Title binding rules by highest specificity with default fallback', () => {
		const rules = [
			{
				id: 'r1',
				conditions: [{ propertyKey: 'role', operator: 'equals' as const, value: 'Participant' }],
				output: 'Certificate of Participation'
			},
			{
				id: 'r2',
				conditions: [
					{ propertyKey: 'role', operator: 'equals' as const, value: 'Participant' },
					{ propertyKey: 'rank', operator: 'not_empty' as const, value: '' }
				],
				output: 'Certificate of Award'
			}
		];

		// Arbiter (no rule matches) -> Default
		expect(resolveTitleBinding('Certificate of Appreciation', rules, { role: 'Arbiter', rank: '' })).toBe(
			'Certificate of Appreciation'
		);
		// Participant without rank -> Rule 1
		expect(
			resolveTitleBinding('Certificate of Appreciation', rules, { role: 'Participant', rank: '' })
		).toBe('Certificate of Participation');
		// Participant with rank -> Rule 2 (more specific wins even if listed after Rule 1)
		expect(
			resolveTitleBinding('Certificate of Appreciation', rules, {
				role: 'Participant',
				rank: 'Champion'
			})
		).toBe('Certificate of Award');

		const textElWithRules = {
			...basePlaceholder,
			type: 'text' as const,
			text: 'Certificate of Appreciation',
			rules
		};
		expect(resolveElementText(textElWithRules, { role: 'Arbiter', rank: '' }, 'export')).toBe(
			'CERTIFICATE OF APPRECIATION'
		);
		expect(resolveElementText(textElWithRules, { role: 'Participant', rank: '' }, 'export')).toBe(
			'CERTIFICATE OF PARTICIPATION'
		);
		expect(
			resolveElementText(textElWithRules, { role: 'Participant', rank: 'Champion' }, 'export')
		).toBe('CERTIFICATE OF AWARD');
	});
});
