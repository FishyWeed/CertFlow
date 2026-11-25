import { describe, expect, it } from 'vitest';
import { computeSnapResult, type RectBox } from './snapping.ts';

describe('computeSnapResult', () => {
	const stageW = 1123;
	const stageH = 794;

	it('snaps an element to equal vertical spacing between an element above and below', () => {
		const top: RectBox = { id: 'name', x: 112, y: 200, width: 900, height: 80 }; // bottom = 280
		const bottom: RectBox = { id: 'event', x: 132, y: 400, width: 860, height: 60 }; // top = 400
		// Free space = 120px, middle element height = 40px -> equal gap = 40px -> exact y = 320
		const dragged: RectBox = { id: 'role', x: 162, y: 317, width: 800, height: 40 };

		const result = computeSnapResult(dragged, [top, bottom], stageW, stageH, 6);

		expect(result.y).toBe(320);
		expect(result.spacingGuides).toHaveLength(2);
		expect(result.spacingGuides[0].gapPx).toBe(40);
		expect(result.spacingGuides[1].gapPx).toBe(40);
	});

	it('snaps a third element below two stacked elements to match their vertical gap', () => {
		const first: RectBox = { id: 'a', x: 200, y: 100, width: 500, height: 50 }; // bottom = 150
		const second: RectBox = { id: 'b', x: 200, y: 180, width: 500, height: 50 }; // gap = 30, bottom = 230
		// Expected third y = 230 + 30 = 260
		const dragged: RectBox = { id: 'c', x: 200, y: 263, width: 500, height: 50 };

		const result = computeSnapResult(dragged, [first, second], stageW, stageH, 6);

		expect(result.y).toBe(260);
		expect(result.spacingGuides).toHaveLength(2);
		expect(result.spacingGuides.every((g) => g.gapPx === 30)).toBe(true);
	});

	it('snaps an element to equal horizontal spacing between two side-by-side elements', () => {
		const left: RectBox = { id: 'sig1', x: 100, y: 600, width: 150, height: 60 }; // right = 250
		const right: RectBox = { id: 'sig3', x: 650, y: 600, width: 150, height: 60 }; // left = 650
		// Free space = 400px, middle width = 100px -> equal gap = 150px -> exact x = 400
		const dragged: RectBox = { id: 'sig2', x: 396, y: 600, width: 100, height: 60 };

		const result = computeSnapResult(dragged, [left, right], stageW, stageH, 6);

		expect(result.x).toBe(400);
		expect(result.spacingGuides).toHaveLength(2);
		expect(result.spacingGuides[0].gapPx).toBe(150);
		expect(result.spacingGuides[1].gapPx).toBe(150);
	});

	it('snaps sibling centre-X alignment while large border frames stay ignored', () => {
		const outerBorder: RectBox = { id: 'border', x: 36, y: 36, width: 1051, height: 722 };
		const title: RectBox = { id: 'title', x: 200, y: 150, width: 400, height: 50 }; // centre = 400
		const dragged: RectBox = { id: 'sub', x: 297, y: 260, width: 200, height: 40 }; // centre = 397 -> snaps to 300

		const result = computeSnapResult(dragged, [outerBorder, title], stageW, stageH, 6);

		expect(result.x).toBe(300);
		expect(result.alignGuides.some((g) => g.orientation === 'vertical' && g.kind === 'sibling')).toBe(
			true
		);
	});
});
