import Konva from 'konva';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import type { ExportFormat, TemplateCanvasState } from '#lib/types/certflow.ts';
import { ensureTemplateFontsLoaded } from '#lib/features/editor/fonts.ts';
import { createRichTextKonvaNode, hasElementRichText } from '#lib/features/editor/rich-text.ts';
import { applyAutoFit, buildKonvaFontStyle, resolveElementText } from '#lib/features/editor/text-utils.ts';

export interface RenderCertificateInput {
	width: number;
	height: number;
	canvasState: TemplateCanvasState;
	data: Record<string, string>;
	format: ExportFormat;
	pixelRatio?: number;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		// Only set anonymous CORS for external URLs so same-origin /api/assets requests include session cookies.
		if (
			/^https?:\/\//i.test(src) &&
			typeof window !== 'undefined' &&
			!src.startsWith(window.location.origin)
		) {
			img.crossOrigin = 'anonymous';
		}
		img.onload = () => resolve(img);
		img.onerror = (err) => reject(err);
		img.src = src;
	});
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
	const base64 = dataUrl.split(',')[1] ?? '';
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Builds an offscreen Konva stage for a template and recipient property map,
 * executes `exporter(stage)`, then cleanly destroys the stage and DOM container.
 */
async function withOffscreenCertificateStage<T>(
	input: Omit<RenderCertificateInput, 'format'>,
	exporter: (stage: Konva.Stage) => Promise<T> | T
): Promise<T> {
	await ensureTemplateFontsLoaded(input.canvasState.elements);

	const container = document.createElement('div');
	container.style.position = 'fixed';
	container.style.left = '-99999px';
	container.style.top = '-99999px';
	document.body.appendChild(container);

	const stage = new Konva.Stage({
		container,
		width: input.width,
		height: input.height
	});

	try {
		const layer = new Konva.Layer();
		stage.add(layer);

		// Background fill
		layer.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: input.width,
				height: input.height,
				fill: input.canvasState.background.color || '#ffffff'
			})
		);

		// Optional background image
		if (input.canvasState.background.imageUrl) {
			try {
				const bgImage = await loadHtmlImage(input.canvasState.background.imageUrl);
				layer.add(
					new Konva.Image({
						x: 0,
						y: 0,
						width: input.width,
						height: input.height,
						image: bgImage
					})
				);
			} catch {
				// Ignore broken background URL so remaining certificate still renders
			}
		}

		for (const el of input.canvasState.elements) {
			if (!el.visible) continue;

			if (el.type === 'placeholder' || el.type === 'text' || el.type === 'title') {
				if (hasElementRichText(el)) {
					layer.add(createRichTextKonvaNode(Konva, el, input.data, 'export', false));
				} else {
					const textNode = new Konva.Text({
						x: el.x,
						y: el.y,
						width: el.width,
						height: el.height,
						rotation: el.rotation,
						opacity: el.opacity,
						text: resolveElementText(el, input.data, 'export'),
						fontFamily: el.fontFamily,
						fontSize: el.fontSize,
						fontStyle: buildKonvaFontStyle(el.fontWeight, el.fontStyle),
						textDecoration: el.textDecoration,
						fill: el.fill,
						align: el.align,
						verticalAlign: el.verticalAlign,
						lineHeight: el.lineHeight,
						letterSpacing: el.letterSpacing,
						wrap: el.wrap,
						ellipsis: el.ellipsis
					});
					applyAutoFit(textNode, el);
					layer.add(textNode);
				}
			} else if (el.type === 'shape') {
				if (el.shapeKind === 'rect') {
					layer.add(
						new Konva.Rect({
							x: el.x,
							y: el.y,
							width: el.width,
							height: el.height,
							rotation: el.rotation,
							opacity: el.opacity,
							fill: el.fill === 'transparent' ? undefined : el.fill,
							stroke: el.stroke,
							strokeWidth: el.strokeWidth,
							cornerRadius: el.cornerRadius ?? 0
						})
					);
				} else if (el.shapeKind === 'circle') {
					layer.add(
						new Konva.Ellipse({
							x: el.x + el.width / 2,
							y: el.y + el.height / 2,
							radiusX: el.width / 2,
							radiusY: el.height / 2,
							rotation: el.rotation,
							opacity: el.opacity,
							fill: el.fill === 'transparent' ? undefined : el.fill,
							stroke: el.stroke,
							strokeWidth: el.strokeWidth
						})
					);
				} else if (el.shapeKind === 'line') {
					layer.add(
						new Konva.Line({
							x: el.x,
							y: el.y,
							points: [0, 0, el.width, 0],
							rotation: el.rotation,
							opacity: el.opacity,
							stroke: el.stroke || el.fill || '#000000',
							strokeWidth: Math.max(1, el.strokeWidth || 2),
							lineCap: 'round'
						})
					);
				}
			} else if ((el.type === 'image' || el.type === 'signature') && el.src) {
				try {
					const img = await loadHtmlImage(el.src);
					layer.add(
						new Konva.Image({
							x: el.x,
							y: el.y,
							width: el.width,
							height: el.height,
							rotation: el.rotation,
							opacity: el.opacity,
							image: img
						})
					);
				} catch {
					// Skip unloaded image
				}
			}
		}

		layer.draw();
		return await exporter(stage);
	} finally {
		stage.destroy();
		container.remove();
	}
}

/**
 * Renders a live PNG data URL for the certificate preview pane using the same Konva pipeline as export.
 */
export async function renderCertificatePreviewDataUrl(
	input: Omit<RenderCertificateInput, 'format'>
): Promise<string> {
	return await withOffscreenCertificateStage(input, (stage) =>
		stage.toDataURL({ mimeType: 'image/png', pixelRatio: input.pixelRatio ?? 1.25 })
	);
}

/**
 * Renders any template + recipient property map offscreen with Konva into a crisp
 * PNG, JPG or PDF byte array. Keeps export output identical to the editor canvas.
 */
export async function renderCertificateBytes(input: RenderCertificateInput): Promise<Uint8Array> {
	return await withOffscreenCertificateStage(input, async (stage) => {
		const ratio = input.pixelRatio ?? 2.5;

		if (input.format === 'png') {
			return dataUrlToUint8Array(stage.toDataURL({ mimeType: 'image/png', pixelRatio: ratio }));
		}

		if (input.format === 'jpg') {
			return dataUrlToUint8Array(
				stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.94, pixelRatio: ratio })
			);
		}

		// PDF: embed the crisp raster render at exact page aspect ratio (72 pt/in)
		const pngBytes = dataUrlToUint8Array(
			stage.toDataURL({ mimeType: 'image/png', pixelRatio: ratio })
		);
		const pdfDoc = await PDFDocument.create();
		const embeddedPng = await pdfDoc.embedPng(pngBytes);
		const pageWidthPt = input.width * 0.75;
		const pageHeightPt = input.height * 0.75;
		const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
		page.drawImage(embeddedPng, {
			x: 0,
			y: 0,
			width: pageWidthPt,
			height: pageHeightPt
		});
		return await pdfDoc.save();
	});
}

export function triggerFileDownload(bytes: Uint8Array, fileName: string, mimeType: string) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	const blob = new Blob([copy.buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

export function formatMimeType(format: ExportFormat): string {
	if (format === 'pdf') return 'application/pdf';
	if (format === 'jpg') return 'image/jpeg';
	return 'image/png';
}

export async function buildBulkCertificatesZip(
	items: Array<{ fileName: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
	const zip = new JSZip();
	for (const item of items) {
		zip.file(item.fileName, item.bytes);
	}
	return await zip.generateAsync({ type: 'uint8array' });
}
