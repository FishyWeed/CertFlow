import { describe, expect, it } from 'vitest';
import {
	applyCropDrag,
	clampCropRect,
	computeInitialCrop,
	computeResizedDimensions,
	computeRotatedBounds,
	normaliseRotation
} from './image-crop.ts';

describe('image crop and resize calculations', () => {
	it('centres an aspect-locked initial crop inside a wider image', () => {
		const crop = computeInitialCrop(1600, 800, 1);
		expect(crop).toEqual({ x: 400, y: 0, width: 800, height: 800 });
	});

	it('clamps crop movement inside image bounds', () => {
		const start = { x: 100, y: 100, width: 400, height: 300 };
		const moved = applyCropDrag(start, 'move', 900, -500, 1000, 800);
		expect(moved).toEqual({ x: 600, y: 0, width: 400, height: 300 });
	});

	it('maintains aspect ratio when dragging a corner handle', () => {
		const start = { x: 0, y: 0, width: 800, height: 400 };
		const resized = applyCropDrag(start, 'se', -200, -50, 1000, 800, 2);
		expect(resized.width).toBe(600);
		expect(resized.height).toBe(300);
	});

	it('links output resize width and height when aspect lock is enabled', () => {
		expect(computeResizedDimensions(1000, 500, 600, 'width', true, 500)).toEqual({
			width: 600,
			height: 300
		});
		expect(computeResizedDimensions(1000, 500, 400, 'height', false, 600)).toEqual({
			width: 600,
			height: 400
		});
	});

	it('clamps oversized rectangles to source dimensions', () => {
		expect(clampCropRect({ x: -20, y: -10, width: 2000, height: 1500 }, 800, 600)).toEqual({
			x: 0,
			y: 0,
			width: 800,
			height: 600
		});
	});

	it('swaps bounds cleanly on 90-degree rotations and expands bounds for arbitrary angles', () => {
		expect(computeRotatedBounds(384, 672, 90)).toEqual({ width: 672, height: 384 });
		expect(computeRotatedBounds(384, 672, -90)).toEqual({ width: 672, height: 384 });
		expect(computeRotatedBounds(384, 672, 180)).toEqual({ width: 384, height: 672 });
		const diag = computeRotatedBounds(100, 100, 45);
		expect(diag.width).toBe(142);
		expect(diag.height).toBe(142);
	});

	it('normalises rotation angles into [-180, 180]', () => {
		expect(normaliseRotation(270)).toBe(-90);
		expect(normaliseRotation(-270)).toBe(90);
		expect(normaliseRotation(180)).toBe(180);
	});
});
