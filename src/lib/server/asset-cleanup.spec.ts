import { describe, expect, it } from 'vitest';
import { formatBytes } from '#lib/config/limits.ts';
import type { TemplateCanvasState } from '#lib/types/certflow.ts';
import { collectReferencedAssets } from './asset-cleanup.ts';

describe('asset reference collection and byte formatting', () => {
	it('collects background, original, image and signature asset IDs and storage keys', () => {
		const state: TemplateCanvasState = {
			version: 1,
			background: {
				color: '#ffffff',
				assetId: 'bg-cropped',
				imageUrl: '/api/assets/file/u1%2Fp1%2Fbg-cropped.webp',
				originalAssetId: 'bg-orig',
				originalImageUrl: '/api/assets/file/u1%2Fp1%2Fbg-orig.webp'
			},
			elements: [
				{
					id: 'el-img',
					name: 'Logo',
					type: 'image',
					assetId: 'logo-1',
					src: '/api/assets/file/u1%2Fp1%2Flogo-1.webp',
					originalAssetId: 'logo-orig',
					originalSrc: '/api/assets/file/u1%2Fp1%2Flogo-orig.webp',
					keepAspectRatio: true,
					x: 10,
					y: 10,
					width: 100,
					height: 100,
					rotation: 0,
					opacity: 1,
					visible: true,
					locked: false
				},
				{
					id: 'el-sig',
					name: 'Signature',
					type: 'signature',
					src: '/api/assets/file/u1%2Fp1%2Flegacy-sig.png',
					keepAspectRatio: true,
					x: 20,
					y: 20,
					width: 120,
					height: 48,
					rotation: 0,
					opacity: 1,
					visible: true,
					locked: false
				}
			]
		};

		const refs = collectReferencedAssets([state]);
		expect(Array.from(refs.assetIds).sort()).toEqual([
			'bg-cropped',
			'bg-orig',
			'logo-1',
			'logo-orig'
		]);
		expect(Array.from(refs.storageKeys).sort()).toEqual([
			'u1/p1/bg-cropped.webp',
			'u1/p1/bg-orig.webp',
			'u1/p1/legacy-sig.png',
			'u1/p1/logo-1.webp',
			'u1/p1/logo-orig.webp'
		]);
	});

	it('formats byte values cleanly for storage usage readouts', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(250 * 1024)).toBe('250 KB');
		expect(formatBytes(4.25 * 1024 * 1024)).toBe('4.3 MB');
	});
});
