import { CORE_PRELOAD_FONTS, FONT_CATALOG_MAP } from '#lib/config/canvas.ts';
import type { CanvasElement } from '#lib/types/certflow.ts';

const SAMPLE_TEXT = 'BESbswy0123456789';
const PIN_CONTAINER_ID = 'certflow-font-pin';
const loadedFontKeys = new Set<string>();
const pendingFontPromises = new Map<string, Promise<void>>();
const stylesheetPromises = new Map<string, Promise<void>>();

const INLINE_FONT_TAG_RE = /<font=([^>]+)>/gi;

export function quoteFontFamily(family: string): string {
	const trimmed = family.trim().replace(/^['"]|['"]$/g, '');
	return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function normalizeFamilyName(family: string): string {
	return family.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Builds the Google Fonts CSS2 stylesheet URL for a catalog font family,
 * or returns `null` for built-in OS system fonts.
 */
export function getGoogleFontStylesheetUrl(family: string): string | null {
	const clean = normalizeFamilyName(family);
	if (!clean) return null;

	const entry = FONT_CATALOG_MAP.get(clean.toLowerCase());
	if (entry?.system) return null;

	const encodedName = (entry?.family ?? clean).replace(/\s+/g, '+');
	const spec = entry?.googleSpec;
	const query = spec ? `family=${encodedName}:${spec}` : `family=${encodedName}`;
	return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/**
 * Injects a Google Fonts <link rel="stylesheet"> on demand for any font family not already loaded
 * in <head>, and resolves once the stylesheet has registered its @font-face rules.
 */
export function ensureFontStylesheet(family: string): Promise<void> {
	if (typeof document === 'undefined' || !document.head) return Promise.resolve();

	const clean = normalizeFamilyName(family);
	if (!clean) return Promise.resolve();

	const key = clean.toLowerCase();
	const existingPromise = stylesheetPromises.get(key);
	if (existingPromise) return existingPromise;

	// Core starter fonts are already linked in src/app.html.
	if (CORE_PRELOAD_FONTS.some((f) => f.toLowerCase() === key)) {
		const resolved = Promise.resolve();
		stylesheetPromises.set(key, resolved);
		return resolved;
	}

	const url = getGoogleFontStylesheetUrl(clean);
	if (!url) {
		const resolved = Promise.resolve();
		stylesheetPromises.set(key, resolved);
		return resolved;
	}

	const existingLink = document.head.querySelector<HTMLLinkElement>(
		`link[data-certflow-font="${CSS.escape(key)}"]`
	);
	if (existingLink) {
		const resolved = Promise.resolve();
		stylesheetPromises.set(key, resolved);
		return resolved;
	}

	const promise = new Promise<void>((resolve) => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = url;
		link.dataset.certflowFont = key;
		const finish = () => resolve();
		link.addEventListener('load', finish, { once: true });
		link.addEventListener('error', finish, { once: true });
		setTimeout(finish, 4000);
		document.head.appendChild(link);
	});

	stylesheetPromises.set(key, promise);
	return promise;
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
 * Keeps requested editor fonts referenced by an invisible rendered DOM container so
 * Chromium never evicts unreferenced Google Font faces between canvas redraws.
 */
function ensureFontPinElement(familiesToPin: string[]): void {
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

	const families = Array.from(new Set(familiesToPin.map(normalizeFamilyName).filter(Boolean)));
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
 * Waits until external font stylesheets have finished registering their @font-face rules.
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
 * Extracts every inline `<font=Font Name>` family referenced in an element's rich text or rules.
 */
export function extractInlineFontFamilies(el: CanvasElement): string[] {
	if (el.type !== 'text' && el.type !== 'placeholder' && el.type !== 'title') return [];

	const sources: string[] = [];
	if (el.type === 'text') {
		sources.push(el.text);
		if (el.fallbackText) sources.push(el.fallbackText);
		if (el.rules) {
			for (const rule of el.rules) sources.push(rule.output);
		}
	} else if (el.type === 'placeholder') {
		sources.push(el.fallbackText);
	} else if (el.type === 'title') {
		sources.push(el.defaultTitle);
		for (const rule of el.rules) sources.push(rule.output);
	}

	const found = new Set<string>();
	for (const src of sources) {
		if (!src || !src.includes('<font=')) continue;
		INLINE_FONT_TAG_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = INLINE_FONT_TAG_RE.exec(src)) !== null) {
			const name = normalizeFamilyName(match[1] ?? '');
			if (name) found.add(name);
		}
	}
	return Array.from(found);
}

/**
 * Ensures a font face stylesheet is injected, downloaded and pinned in the DOM for HTML5 Canvas / Konva rendering.
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

	const clean = normalizeFamilyName(fontFamily);
	if (!clean) return true;

	const entry = FONT_CATALOG_MAP.get(clean.toLowerCase());
	if (entry?.system) return true;

	const requestedSpec = buildFontSpec(clean, fontWeight, fontStyle);
	const baseSpec = buildFontSpec(clean, 400, 'normal');
	const cacheKey = `${requestedSpec}|${baseSpec}`;

	if (loadedFontKeys.has(cacheKey) && document.fonts.check(baseSpec, SAMPLE_TEXT)) {
		return true;
	}

	let promise = pendingFontPromises.get(cacheKey);
	if (!promise) {
		promise = (async () => {
			try {
				await ensureFontStylesheet(clean);
				ensureFontPinElement([clean]);
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
 * Preloads and pins the core starter fonts so initial editor interactions are instant.
 * All other catalog fonts load on demand when previewed, selected or exported.
 */
export function preloadEditorFonts(onAnyLoaded?: () => void): void {
	if (typeof document === 'undefined' || !('fonts' in document)) return;

	ensureFontPinElement([...CORE_PRELOAD_FONTS]);

	void (async () => {
		await waitForFontStylesheets();
		const specs = CORE_PRELOAD_FONTS.flatMap((family) => [
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
 * Awaits and pins every font face referenced by a template (including inline `<font=...>` tags)
 * before offscreen Konva preview or PNG/JPG/PDF export.
 */
export async function ensureTemplateFontsLoaded(elements: CanvasElement[]): Promise<void> {
	if (typeof document === 'undefined' || !('fonts' in document)) return;

	const usedFamilies = new Set<string>();
	const specs = new Set<string>();

	for (const el of elements) {
		if (el.type === 'text' || el.type === 'placeholder' || el.type === 'title') {
			const baseFamily = normalizeFamilyName(el.fontFamily);
			if (baseFamily) {
				usedFamilies.add(baseFamily);
				specs.add(buildFontSpec(baseFamily, 400, 'normal'));
				specs.add(buildFontSpec(baseFamily, el.fontWeight, el.fontStyle));
			}
			for (const inlineFamily of extractInlineFontFamilies(el)) {
				usedFamilies.add(inlineFamily);
				specs.add(buildFontSpec(inlineFamily, 400, 'normal'));
				specs.add(buildFontSpec(inlineFamily, 700, 'normal'));
				specs.add(buildFontSpec(inlineFamily, 400, 'italic'));
			}
		}
	}

	if (usedFamilies.size === 0) return;

	await Promise.all(Array.from(usedFamilies).map((family) => ensureFontStylesheet(family)));
	ensureFontPinElement(Array.from(usedFamilies));
	await waitForFontStylesheets();

	if (specs.size > 0) {
		await Promise.all(
			Array.from(specs).map((spec) => document.fonts.load(spec, SAMPLE_TEXT).catch(() => []))
		);
	}
	await document.fonts.ready;
}
