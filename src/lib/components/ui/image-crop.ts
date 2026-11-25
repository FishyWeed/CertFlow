export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export type CropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * Normalises any degree angle into the [-180, 180] range.
 */
export function normaliseRotation(degrees: number): number {
	const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
	return wrapped === -180 && degrees > 0 ? 180 : wrapped;
}

/**
 * Computes the bounding pixel dimensions of an image after rotating by the given degrees.
 */
export function computeRotatedBounds(
	width: number,
	height: number,
	degrees: number
): { width: number; height: number } {
	const w = Math.max(1, Math.round(width));
	const h = Math.max(1, Math.round(height));
	const mod = ((Math.round(degrees) % 360) + 360) % 360;
	if (mod === 0 || mod === 180) return { width: w, height: h };
	if (mod === 90 || mod === 270) return { width: h, height: w };

	const rad = (degrees * Math.PI) / 180;
	const cos = Math.abs(Math.cos(rad));
	const sin = Math.abs(Math.sin(rad));
	return {
		width: Math.max(1, Math.ceil(w * cos + h * sin)),
		height: Math.max(1, Math.ceil(w * sin + h * cos))
	};
}

/**
 * Draws an image rotated by the given degrees onto a target canvas resized to its rotated bounds.
 */
export function drawRotatedImageToCanvas(
	target: HTMLCanvasElement,
	img: HTMLImageElement,
	degrees: number
): { width: number; height: number } {
	const bounds = computeRotatedBounds(img.naturalWidth, img.naturalHeight, degrees);
	target.width = bounds.width;
	target.height = bounds.height;

	const ctx = target.getContext('2d');
	if (!ctx) return bounds;

	ctx.clearRect(0, 0, bounds.width, bounds.height);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.save();
	ctx.translate(bounds.width / 2, bounds.height / 2);
	ctx.rotate((degrees * Math.PI) / 180);
	ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
	ctx.restore();

	return bounds;
}

/**
 * Computes the largest centred crop rectangle inside an image.
 * If aspectRatio is set, fits that exact width / height ratio inside natural bounds.
 */
export function computeInitialCrop(
	naturalW: number,
	naturalH: number,
	aspectRatio?: number
): CropRect {
	const w = Math.max(1, naturalW);
	const h = Math.max(1, naturalH);
	if (!aspectRatio || aspectRatio <= 0) {
		return { x: 0, y: 0, width: w, height: h };
	}

	const imageRatio = w / h;
	if (imageRatio > aspectRatio) {
		const cropH = h;
		const cropW = Math.round(cropH * aspectRatio);
		return {
			x: Math.round((w - cropW) / 2),
			y: 0,
			width: Math.max(1, Math.min(w, cropW)),
			height: cropH
		};
	}

	const cropW = w;
	const cropH = Math.round(cropW / aspectRatio);
	return {
		x: 0,
		y: Math.round((h - cropH) / 2),
		width: cropW,
		height: Math.max(1, Math.min(h, cropH))
	};
}

/**
 * Clamps a crop rectangle inside [0..naturalW, 0..naturalH] while keeping minSize.
 */
export function clampCropRect(
	rect: CropRect,
	naturalW: number,
	naturalH: number,
	minSize = 16
): CropRect {
	const effMinW = Math.min(minSize, naturalW);
	const effMinH = Math.min(minSize, naturalH);

	const width = Math.max(effMinW, Math.min(naturalW, Math.round(rect.width)));
	const height = Math.max(effMinH, Math.min(naturalH, Math.round(rect.height)));
	const x = Math.max(0, Math.min(naturalW - width, Math.round(rect.x)));
	const y = Math.max(0, Math.min(naturalH - height, Math.round(rect.y)));

	return { x, y, width, height };
}

/**
 * Applies a drag delta (in natural image pixels) to a starting crop rectangle.
 * Supports free resizing or aspect-locked resizing across all 8 handles plus moving.
 */
export function applyCropDrag(
	start: CropRect,
	handle: CropHandle,
	dx: number,
	dy: number,
	naturalW: number,
	naturalH: number,
	aspectRatio?: number,
	minSize = 24
): CropRect {
	const effMin = Math.min(minSize, naturalW, naturalH);

	if (handle === 'move') {
		return clampCropRect(
			{
				x: start.x + dx,
				y: start.y + dy,
				width: start.width,
				height: start.height
			},
			naturalW,
			naturalH,
			effMin
		);
	}

	let left = start.x;
	let top = start.y;
	let right = start.x + start.width;
	let bottom = start.y + start.height;

	if (handle.includes('w')) left = Math.min(right - effMin, Math.max(0, start.x + dx));
	if (handle.includes('e')) right = Math.max(left + effMin, Math.min(naturalW, start.x + start.width + dx));
	if (handle.includes('n')) top = Math.min(bottom - effMin, Math.max(0, start.y + dy));
	if (handle.includes('s')) bottom = Math.max(top + effMin, Math.min(naturalH, start.y + start.height + dy));

	if (!aspectRatio || aspectRatio <= 0) {
		return clampCropRect(
			{ x: left, y: top, width: right - left, height: bottom - top },
			naturalW,
			naturalH,
			effMin
		);
	}

	// Aspect-locked resize: derive the paired axis from whichever axis moved on edge or corner drags.
	let w = right - left;
	let h = bottom - top;

	if (handle === 'n' || handle === 's') {
		w = h * aspectRatio;
		const cx = start.x + start.width / 2;
		left = cx - w / 2;
		if (left < 0) {
			left = 0;
			w = Math.min(w, naturalW);
			h = w / aspectRatio;
		}
		if (left + w > naturalW) {
			w = naturalW - left;
			h = w / aspectRatio;
		}
		top = handle === 'n' ? bottom - h : top;
	} else if (handle === 'e' || handle === 'w') {
		h = w / aspectRatio;
		const cy = start.y + start.height / 2;
		top = cy - h / 2;
		if (top < 0) {
			top = 0;
			h = Math.min(h, naturalH);
			w = h * aspectRatio;
		}
		if (top + h > naturalH) {
			h = naturalH - top;
			w = h * aspectRatio;
		}
		left = handle === 'w' ? right - w : left;
	} else {
		// Corner handle: honour width and fit height inside available bounds.
		h = w / aspectRatio;
		const maxH = handle.includes('n') ? bottom : naturalH - top;
		if (h > maxH) {
			h = maxH;
			w = h * aspectRatio;
		}
		const maxW = handle.includes('w') ? right : naturalW - left;
		if (w > maxW) {
			w = maxW;
			h = w / aspectRatio;
		}
		if (handle.includes('w')) left = right - w;
		if (handle.includes('n')) top = bottom - h;
	}

	return clampCropRect({ x: left, y: top, width: w, height: h }, naturalW, naturalH, effMin);
}

/**
 * Computes output resize dimensions while optionally preserving the crop aspect ratio.
 */
export function computeResizedDimensions(
	cropW: number,
	cropH: number,
	nextValue: number,
	axis: 'width' | 'height',
	lockAspect: boolean,
	currentOther: number,
	maxDim = 4096
): { width: number; height: number } {
	const clamped = Math.max(16, Math.min(maxDim, Math.round(nextValue || 16)));
	if (!lockAspect || cropW <= 0 || cropH <= 0) {
		return axis === 'width'
			? { width: clamped, height: Math.max(16, Math.min(maxDim, Math.round(currentOther))) }
			: { width: Math.max(16, Math.min(maxDim, Math.round(currentOther))), height: clamped };
	}

	const ratio = cropW / cropH;
	if (axis === 'width') {
		return {
			width: clamped,
			height: Math.max(16, Math.min(maxDim, Math.round(clamped / ratio)))
		};
	}
	return {
		width: Math.max(16, Math.min(maxDim, Math.round(clamped * ratio))),
		height: clamped
	};
}

/**
 * Renders the cropped and resized image onto an offscreen canvas and exports a Blob.
 */
export async function renderCroppedImageBlob(
	source: CanvasImageSource,
	crop: CropRect,
	outputWidth: number,
	outputHeight: number,
	preferredMimeType = 'image/png'
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
	const outW = Math.max(16, Math.min(4096, Math.round(outputWidth)));
	const outH = Math.max(16, Math.min(4096, Math.round(outputHeight)));

	const canvas = document.createElement('canvas');
	canvas.width = outW;
	canvas.height = outH;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not initialise canvas context for image export.');
	}

	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';

	const useJpeg = preferredMimeType === 'image/jpeg';
	const mimeType = useJpeg ? 'image/jpeg' : 'image/png';
	const ext = useJpeg ? 'jpg' : 'png';

	if (useJpeg) {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, outW, outH);
	}

	ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(b) => {
				if (b) resolve(b);
				else reject(new Error('Could not export cropped image.'));
			},
			mimeType,
			useJpeg ? 0.92 : undefined
		);
	});

	return { blob, mimeType, ext };
}
