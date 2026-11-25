/**
 * Standard responsive breakpoints for CertFlow.
 * Every page and feature must render cleanly without horizontal overflow across all three tiers.
 */
export const LAYOUT_BREAKPOINTS = {
	mobileMax: 767, // < 768px (phones: 360px - 430px typical)
	tabletMin: 768, // 768px - 1023px (tablets, split screens)
	desktopMin: 1024 // >= 1024px (laptops and desktop monitors)
} as const;

export type ViewportTier = 'mobile' | 'tablet' | 'desktop';

export function getViewportTier(width: number): ViewportTier {
	if (width < LAYOUT_BREAKPOINTS.tabletMin) return 'mobile';
	if (width < LAYOUT_BREAKPOINTS.desktopMin) return 'tablet';
	return 'desktop';
}
