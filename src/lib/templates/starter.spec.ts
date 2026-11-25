import { describe, expect, it } from 'vitest';
import { FONT_CATALOG_MAP } from '#lib/config/canvas.ts';
import { createStarterTemplateState, STARTER_TEMPLATE_PRESETS } from './starter.ts';

describe('starter templates', () => {
	it('creates the default starter template with core recipient tokens', () => {
		const state = createStarterTemplateState('Annual Summit');
		expect(state.version).toBe(1);
		const texts = state.elements
			.filter((el) => el.type === 'text')
			.map((el) => el.text)
			.join(' ');
		expect(texts).toContain('{{rank}}');
		expect(texts).toContain('{{name}}');
		expect(texts).toContain('{{role}}');
		expect(texts).toContain('{{title}}');
	});

	it('defines valid starter presets with unique IDs, catalogued fonts and core tokens', () => {
		expect(STARTER_TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(4);
		const presetIds = new Set<string>();

		for (const preset of STARTER_TEMPLATE_PRESETS) {
			expect(presetIds.has(preset.id)).toBe(false);
			presetIds.add(preset.id);
			expect(preset.width).toBeGreaterThanOrEqual(300);
			expect(preset.height).toBeGreaterThanOrEqual(300);

			const state = preset.createState('Design Forum');
			expect(state.version).toBe(1);
			expect(state.background.color).toMatch(/^#[0-9a-f]{6}$/i);

			const elementIds = new Set<string>();
			let allText = '';
			for (const el of state.elements) {
				expect(elementIds.has(el.id)).toBe(false);
				elementIds.add(el.id);

				if (el.type === 'text') {
					allText += ` ${el.text}`;
					expect(FONT_CATALOG_MAP.has(el.fontFamily.toLowerCase())).toBe(true);
				}
			}

			expect(allText).toContain('{{rank}}');
			expect(allText).toContain('{{name}}');
			expect(allText).toContain('{{role}}');
			expect(allText).toContain('{{title}}');
		}
	});
});
