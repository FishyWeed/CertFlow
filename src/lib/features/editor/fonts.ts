import { DEFAULT_FONT_FAMILIES } from '#lib/config/canvas.ts';
import type { CanvasElement } from '#lib/types/certflow.ts';

const SAMPLE_TEXT = 'BESbswy0123456789';
const PIN_CONTAINER_ID = 'certflow-font-pin';
const loadedFontKeys = new Set<string>();
const pendingFontPromises = new Map<string, Promise<void>>();

export function quoteFontFamily(family: string): string {
	const trimmed = family.trim().replace(/^['"]|['"]$/g, '');
	return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function buildFontSpec(
	fontFamily: string,
	fontWeight = 400,
	fontStyle: 'normal' | 'italic' = 'normal'
): string {
	const quoted = quoteFontFamily(fontFamily);
	const stylePrefix = fontStyle === 'italic' ? 'italic ' : '';
	return `${stylePrefix}${fontWeight} 24px ${quoted}`;
}

/**
 * Keeps all built-in editor fonts referenced by an invisible rendered DOM container so
 * Chromium never evicts unreferenced Google Font faces between canvas redraws.
 */
function ensureFontPinElement(extraFamilies: string[] = []): void {
	if (typeof document === 'undefined' || !document.body) return;

	let container = document.getElementById(PIN_CONTAINER_ID);
	if (!container) {
		container = document.createElement('div');
		container.id = PIN_CONTAINER_ID;
		container.setAttribute('aria-hidden', 'true');
		container.style.cssText =
			'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;user-select:none;font-size:16px;line-height:1;';
		document.body.appendChild(container);
	}

	const families = Array.from(new Set<string>([...DEFAULT_FONT_FAMILIES, ...extraFamilies]));
	for (const family of families) {
		const quoted = quoteFontFamily(family);
		const variants: Array<[number, 'normal' | 'italic']> = [
			[400, 'normal'],
			[700, 'normal'],
			[400, 'italic'],
			[700, 'italic']
		];
		for (const [weight, style] of variants) {
			const key = `${family}|${weight}|${style}`;
			if (container.querySelector(`[data-font-key="${CSS.escape(key)}"]`)) continue;
			const span = document.createElement('span');
			span.dataset.fontKey = key;
			span.style.fontFamily = quoted;
			span.style.fontWeight = String(weight);
			span.style.fontStyle = style;
			span.textContent = 'Aa';
			container.appendChild(span);
		}
	}
}

/**
 * Waits until external font stylesheets (such as Google Fonts <link>) have finished
 * loading and registering their @font-face rules in document.fonts.
 */
async function waitForFontStylesheets(): Promise<void> {
	if (typeof document === 'undefined' || typeof window === 'undefined') return;
	if (document.readyState !== 'complete') {
		await new Promise<void>((resolve) => {
			const done = () => resolve();
			window.addEventListener('load', done, { once: true });
			setTimeout(done, 4000);
		});
	}
	if ('fonts' in document) {
		await document.fonts.ready;
	}
}

/**
 * Ensures a font face is downloaded and pinned in the DOM for HTML5 Canvas / Konva rendering.
 * Returns `true` when already available synchronously, or triggers an async load and
 * invokes `onLoaded` as soon as the font finishes downloading so the canvas redraws immediately.
 */
export function ensureFontLoaded(
	fontFamily: string,
	fontWeight = 400,
	fontStyle: 'normal' | 'italic' = 'normal',
	onLoaded?: () => void
): boolean {
	if (typeof document === 'undefined' || !('fonts' in document)) return true;

	ensureFontPinElement([fontFamily]);

	const requestedSpec = buildFontSpec(fontFamily, fontWeight, fontStyle);
	const baseSpec = buildFontSpec(fontFamily, 400, 'normal');
	const cacheKey = `${requestedSpec}|${baseSpec}`;

	if (loadedFontKeys.has(cacheKey) && document.fonts.check(baseSpec, SAMPLE_TEXT)) {
		return true;
	}

	if (
		document.fonts.check(requestedSpec, SAMPLE_TEXT) &&
		document.fonts.check(baseSpec, SAMPLE_TEXT)
	) {
		loadedFontKeys.add(cacheKey);
		return true;
	}

	let promise = pendingFontPromises.get(cacheKey);
	if (!promise) {
		promise = (async () => {
			try {
				await waitForFontStylesheets();
				const loads = [document.fonts.load(baseSpec, SAMPLE_TEXT).catch(() => [])];
				if (requestedSpec !== baseSpec) {
					loads.push(document.fonts.load(requestedSpec, SAMPLE_TEXT).catch(() => []));
				}
				const results = await Promise.all(loads);
				const loadedAny = results.some((faces) => faces.length > 0);
				if (loadedAny || document.fonts.check(baseSpec, SAMPLE_TEXT)) {
					loadedFontKeys.add(cacheKey);
				}
			} finally {
				pendingFontPromises.delete(cacheKey);
			}
		})();
		pendingFontPromises.set(cacheKey, promise);
	}

	if (onLoaded) {
		void promise.then(() => onLoaded());
	}

	return false;
}

/**
 * Preloads and pins all built-in editor Google Fonts so switching typefaces in the inspector
 * renders the real font immediately and never flips back when clicking out.
 */
export function preloadEditorFonts(onAnyLoaded?: () => void): void {
	if (typeof document === 'undefined' || !('fonts' in document)) return;

	ensureFontPinElement();

	void (async () => {
		await waitForFontStylesheets();
		const specs = DEFAULT_FONT_FAMILIES.flatMap((family) => [
			buildFontSpec(family, 400, 'normal'),
			buildFontSpec(family, 700, 'normal'),
			buildFontSpec(family, 400, 'italic'),
			buildFontSpec(family, 700, 'italic')
		]);
		await Promise.all(specs.map((spec) => document.fonts.load(spec, SAMPLE_TEXT).catch(() => [])));
		onAnyLoaded?.();
	})();
}

/**
 * Awaits and pins every font face referenced by a template before offscreen Konva preview or export.
 */
export async function ensureTemplateFontsLoaded(elements: CanvasElement[]): Promise<void> {
	if (typeof document === 'undefined' || !('fonts' in document)) return;

	const extraFamilies: string[] = [];
	for (const el of elements) {
		if (el.type === 'text' || el.type === 'placeholder' || el.type === 'title') {
			extraFamilies.push(el.fontFamily);
		}
	}
	ensureFontPinElement(extraFamilies);

	await waitForFontStylesheets();
	const specs = new Set<string>();
	for (const el of elements) {
		if (el.type === 'text' || el.type === 'placeholder' || el.type === 'title') {
			specs.add(buildFontSpec(el.fontFamily, 400, 'normal'));
			specs.add(buildFontSpec(el.fontFamily, el.fontWeight, el.fontStyle));
		}
	}

	if (specs.size > 0) {
		await Promise.all(
			Array.from(specs).map((spec) => document.fonts.load(spec, SAMPLE_TEXT).catch(() => []))
		);
	}
	await document.fonts.ready;
}
