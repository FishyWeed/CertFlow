export interface CanvasPreset {
	id: string;
	label: string;
	width: number;
	height: number;
}

// Base canvas dimensions at 96 DPI; exports scale up for crisp ~300 DPI output.
export const CANVAS_PRESETS: CanvasPreset[] = [
	{ id: 'a4-landscape', label: 'A4 Landscape', width: 1123, height: 794 },
	{ id: 'a4-portrait', label: 'A4 Portrait', width: 794, height: 1123 },
	{ id: 'a5-landscape', label: 'A5 Landscape', width: 794, height: 559 },
	{ id: 'a5-portrait', label: 'A5 Portrait', width: 559, height: 794 },
	{ id: 'a3-landscape', label: 'A3 Landscape', width: 1587, height: 1123 },
	{ id: 'letter-landscape', label: 'US Letter Landscape', width: 1056, height: 816 },
	{ id: 'letter-portrait', label: 'US Letter Portrait', width: 816, height: 1056 },
	{ id: 'legal-landscape', label: 'US Legal Landscape', width: 1344, height: 816 },
	{ id: 'hd-landscape', label: '16:9 HD Widescreen', width: 1280, height: 720 },
	{ id: 'fhd-landscape', label: '16:9 Full HD', width: 1920, height: 1080 },
	{ id: 'standard-4-3', label: '4:3 Standard', width: 1024, height: 768 },
	{ id: 'square-1-1', label: 'Square (1:1)', width: 1080, height: 1080 },
	{ id: 'social-4-5', label: 'Portrait (4:5)', width: 1080, height: 1350 }
];

export const DEFAULT_CANVAS_PRESET = CANVAS_PRESETS[0];

export const DEFAULT_FONT_FAMILIES = [
	'Georgia',
	'Inter',
	'Playfair Display',
	'Cinzel',
	'Cormorant Garamond',
	'Montserrat',
	'Lora',
	'Great Vibes'
] as const;
