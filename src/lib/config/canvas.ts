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

export type FontCategory = 'serif' | 'script' | 'sans' | 'display' | 'slab' | 'mono';

export interface FontDefinition {
	family: string;
	category: FontCategory;
	/** Google Fonts CSS2 axis suffix (e.g. 'ital,wght@0,400;0,700;1,400;1,700', 'wght@400;700', or '' for regular 400). */
	googleSpec?: string;
	/** True for built-in OS system fonts that do not require downloading a webfont stylesheet. */
	system?: boolean;
}

export const FONT_CATEGORIES: Array<{ id: FontCategory; label: string; shortLabel: string }> = [
	{ id: 'serif', label: 'Serif & Formal', shortLabel: 'Serif' },
	{ id: 'script', label: 'Calligraphy & Script', shortLabel: 'Script' },
	{ id: 'sans', label: 'Modern Sans-Serif', shortLabel: 'Sans' },
	{ id: 'display', label: 'Display & Ceremonial', shortLabel: 'Display' },
	{ id: 'slab', label: 'Slab Serif', shortLabel: 'Slab' },
	{ id: 'mono', label: 'Monospace & Codes', shortLabel: 'Mono' }
];

const FULL = 'ital,wght@0,400;0,700;1,400;1,700';
const WEIGHTS = 'wght@400;700';
const ITALIC = 'ital@0;1';
const REGULAR = '';

export const FONT_CATALOG: FontDefinition[] = [
	// Serif & Formal (Classic Certificate Titles & Names)
	{ family: 'Playfair Display', category: 'serif', googleSpec: FULL },
	{ family: 'Playfair Display SC', category: 'serif', googleSpec: FULL },
	{ family: 'Cinzel', category: 'serif', googleSpec: WEIGHTS },
	{ family: 'Cinzel Decorative', category: 'serif', googleSpec: WEIGHTS },
	{ family: 'Cormorant Garamond', category: 'serif', googleSpec: FULL },
	{ family: 'Cormorant SC', category: 'serif', googleSpec: WEIGHTS },
	{ family: 'Lora', category: 'serif', googleSpec: FULL },
	{ family: 'Merriweather', category: 'serif', googleSpec: FULL },
	{ family: 'EB Garamond', category: 'serif', googleSpec: FULL },
	{ family: 'Libre Baskerville', category: 'serif', googleSpec: FULL },
	{ family: 'Crimson Pro', category: 'serif', googleSpec: FULL },
	{ family: 'Spectral', category: 'serif', googleSpec: FULL },
	{ family: 'Baskervville', category: 'serif', googleSpec: ITALIC },
	{ family: 'Bodoni Moda', category: 'serif', googleSpec: FULL },
	{ family: 'DM Serif Display', category: 'serif', googleSpec: ITALIC },
	{ family: 'DM Serif Text', category: 'serif', googleSpec: ITALIC },
	{ family: 'Fraunces', category: 'serif', googleSpec: FULL },
	{ family: 'Source Serif 4', category: 'serif', googleSpec: FULL },
	{ family: 'PT Serif', category: 'serif', googleSpec: FULL },
	{ family: 'Vollkorn', category: 'serif', googleSpec: FULL },
	{ family: 'Alegreya', category: 'serif', googleSpec: FULL },
	{ family: 'Newsreader', category: 'serif', googleSpec: FULL },
	{ family: 'Gelasio', category: 'serif', googleSpec: FULL },
	{ family: 'Cardo', category: 'serif', googleSpec: 'ital,wght@0,400;0,700;1,400' },
	{ family: 'Prata', category: 'serif', googleSpec: REGULAR },
	{ family: 'IM Fell English', category: 'serif', googleSpec: ITALIC },
	{ family: 'Gideon Roman', category: 'serif', googleSpec: REGULAR },
	{ family: 'Georgia', category: 'serif', system: true },
	{ family: 'Times New Roman', category: 'serif', system: true },

	// Calligraphy & Script (Signatures & Elegant Recipient Names)
	{ family: 'Great Vibes', category: 'script', googleSpec: REGULAR },
	{ family: 'Alex Brush', category: 'script', googleSpec: REGULAR },
	{ family: 'Allura', category: 'script', googleSpec: REGULAR },
	{ family: 'Dancing Script', category: 'script', googleSpec: WEIGHTS },
	{ family: 'Pinyon Script', category: 'script', googleSpec: REGULAR },
	{ family: 'Parisienne', category: 'script', googleSpec: REGULAR },
	{ family: 'Sacramento', category: 'script', googleSpec: REGULAR },
	{ family: 'Tangerine', category: 'script', googleSpec: WEIGHTS },
	{ family: 'Italianno', category: 'script', googleSpec: REGULAR },
	{ family: 'Herr Von Muellerhoff', category: 'script', googleSpec: REGULAR },
	{ family: 'Petit Formal Script', category: 'script', googleSpec: REGULAR },
	{ family: 'Rouge Script', category: 'script', googleSpec: REGULAR },
	{ family: 'Satisfy', category: 'script', googleSpec: REGULAR },
	{ family: 'Pacifico', category: 'script', googleSpec: REGULAR },
	{ family: 'Caveat', category: 'script', googleSpec: WEIGHTS },
	{ family: 'Kaushan Script', category: 'script', googleSpec: REGULAR },
	{ family: 'Courgette', category: 'script', googleSpec: REGULAR },
	{ family: 'Marck Script', category: 'script', googleSpec: REGULAR },
	{ family: 'Mr De Haviland', category: 'script', googleSpec: REGULAR },
	{ family: 'Mrs Saint Delafield', category: 'script', googleSpec: REGULAR },
	{ family: 'Yellowtail', category: 'script', googleSpec: REGULAR },
	{ family: 'Arizonia', category: 'script', googleSpec: REGULAR },
	{ family: 'Kalam', category: 'script', googleSpec: WEIGHTS },

	// Modern Sans-Serif (Clean Subtitles, Event Info & Body Text)
	{ family: 'Inter', category: 'sans', googleSpec: FULL },
	{ family: 'Montserrat', category: 'sans', googleSpec: FULL },
	{ family: 'Poppins', category: 'sans', googleSpec: FULL },
	{ family: 'Open Sans', category: 'sans', googleSpec: FULL },
	{ family: 'Lato', category: 'sans', googleSpec: FULL },
	{ family: 'Roboto', category: 'sans', googleSpec: FULL },
	{ family: 'Raleway', category: 'sans', googleSpec: FULL },
	{ family: 'Nunito', category: 'sans', googleSpec: FULL },
	{ family: 'Plus Jakarta Sans', category: 'sans', googleSpec: FULL },
	{ family: 'DM Sans', category: 'sans', googleSpec: FULL },
	{ family: 'Outfit', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Manrope', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Work Sans', category: 'sans', googleSpec: FULL },
	{ family: 'Source Sans 3', category: 'sans', googleSpec: FULL },
	{ family: 'Oswald', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Jost', category: 'sans', googleSpec: FULL },
	{ family: 'Quicksand', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Urbanist', category: 'sans', googleSpec: FULL },
	{ family: 'Rubik', category: 'sans', googleSpec: FULL },
	{ family: 'Mulish', category: 'sans', googleSpec: FULL },
	{ family: 'Barlow', category: 'sans', googleSpec: FULL },
	{ family: 'Fira Sans', category: 'sans', googleSpec: FULL },
	{ family: 'Karla', category: 'sans', googleSpec: FULL },
	{ family: 'Josefin Sans', category: 'sans', googleSpec: FULL },
	{ family: 'Figtree', category: 'sans', googleSpec: FULL },
	{ family: 'Lexend', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Space Grotesk', category: 'sans', googleSpec: WEIGHTS },
	{ family: 'Trebuchet MS', category: 'sans', system: true },

	// Display & Ceremonial (Headings, Diplomas, Crests & Awards)
	{ family: 'Abril Fatface', category: 'display', googleSpec: REGULAR },
	{ family: 'Bebas Neue', category: 'display', googleSpec: REGULAR },
	{ family: 'Anton', category: 'display', googleSpec: REGULAR },
	{ family: 'Archivo Black', category: 'display', googleSpec: REGULAR },
	{ family: 'UnifrakturMaguntia', category: 'display', googleSpec: REGULAR },
	{ family: 'MedievalSharp', category: 'display', googleSpec: REGULAR },
	{ family: 'Uncial Antiqua', category: 'display', googleSpec: REGULAR },
	{ family: 'Marcellus', category: 'display', googleSpec: REGULAR },
	{ family: 'Forum', category: 'display', googleSpec: REGULAR },
	{ family: 'Poiret One', category: 'display', googleSpec: REGULAR },
	{ family: 'Philosopher', category: 'display', googleSpec: FULL },
	{ family: 'Yeseva One', category: 'display', googleSpec: REGULAR },
	{ family: 'Berkshire Swash', category: 'display', googleSpec: REGULAR },
	{ family: 'Lobster', category: 'display', googleSpec: REGULAR },
	{ family: 'Righteous', category: 'display', googleSpec: REGULAR },
	{ family: 'Syne', category: 'display', googleSpec: WEIGHTS },
	{ family: 'Comfortaa', category: 'display', googleSpec: WEIGHTS },
	{ family: 'Fredoka', category: 'display', googleSpec: WEIGHTS },
	{ family: 'Staatliches', category: 'display', googleSpec: REGULAR },

	// Slab Serif & Editorial
	{ family: 'Roboto Slab', category: 'slab', googleSpec: WEIGHTS },
	{ family: 'Arvo', category: 'slab', googleSpec: FULL },
	{ family: 'Bitter', category: 'slab', googleSpec: FULL },
	{ family: 'Zilla Slab', category: 'slab', googleSpec: FULL },
	{ family: 'Josefin Slab', category: 'slab', googleSpec: FULL },
	{ family: 'Crete Round', category: 'slab', googleSpec: ITALIC },
	{ family: 'Rokkitt', category: 'slab', googleSpec: FULL },
	{ family: 'Alfa Slab One', category: 'slab', googleSpec: REGULAR },

	// Monospace & Codes (Certificate IDs, Dates & Serial Numbers)
	{ family: 'JetBrains Mono', category: 'mono', googleSpec: FULL },
	{ family: 'Fira Code', category: 'mono', googleSpec: WEIGHTS },
	{ family: 'Source Code Pro', category: 'mono', googleSpec: FULL },
	{ family: 'IBM Plex Mono', category: 'mono', googleSpec: FULL },
	{ family: 'Space Mono', category: 'mono', googleSpec: FULL },
	{ family: 'Roboto Mono', category: 'mono', googleSpec: FULL },
	{ family: 'Inconsolata', category: 'mono', googleSpec: WEIGHTS }
];

export const CORE_PRELOAD_FONTS = [
	'Georgia',
	'Inter',
	'Playfair Display',
	'Cinzel',
	'Cormorant Garamond',
	'Montserrat',
	'Lora',
	'Great Vibes'
] as const;

export const DEFAULT_FONT_FAMILIES: string[] = FONT_CATALOG.map((f) => f.family);

export const FONT_CATALOG_MAP = new Map<string, FontDefinition>(
	FONT_CATALOG.map((f) => [f.family.toLowerCase(), f])
);
