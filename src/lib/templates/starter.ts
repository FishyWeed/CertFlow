import type {
	ShapeCanvasElement,
	StaticTextCanvasElement,
	TemplateCanvasState
} from '#lib/types/certflow.ts';

export interface StarterTemplatePreset {
	id: string;
	name: string;
	styleTag: string;
	width: number;
	height: number;
	createState: (defaultEventTitle?: string) => TemplateCanvasState;
}

function makeRect(
	overrides: Partial<ShapeCanvasElement> &
		Pick<ShapeCanvasElement, 'id' | 'name' | 'x' | 'y' | 'width' | 'height'>
): ShapeCanvasElement {
	return {
		type: 'shape',
		shapeKind: 'rect',
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
		fill: 'transparent',
		stroke: '#000000',
		strokeWidth: 2,
		cornerRadius: 0,
		...overrides
	};
}

function makeCircle(
	overrides: Partial<ShapeCanvasElement> &
		Pick<ShapeCanvasElement, 'id' | 'name' | 'x' | 'y' | 'width' | 'height'>
): ShapeCanvasElement {
	return {
		type: 'shape',
		shapeKind: 'circle',
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
		fill: 'transparent',
		stroke: '#000000',
		strokeWidth: 2,
		...overrides
	};
}

function makeLine(
	overrides: Partial<ShapeCanvasElement> &
		Pick<ShapeCanvasElement, 'id' | 'name' | 'x' | 'y' | 'width'>
): ShapeCanvasElement {
	return {
		type: 'shape',
		shapeKind: 'line',
		height: 2,
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
		fill: 'transparent',
		stroke: '#000000',
		strokeWidth: 2,
		...overrides
	};
}

function makeText(
	overrides: Partial<StaticTextCanvasElement> &
		Pick<StaticTextCanvasElement, 'id' | 'name' | 'text' | 'x' | 'y' | 'width' | 'height'>
): StaticTextCanvasElement {
	return {
		type: 'text',
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
		fontFamily: 'Inter',
		fontSize: 20,
		fontWeight: 400,
		fontStyle: 'normal',
		textDecoration: '',
		textTransform: 'none',
		fill: '#000000',
		align: 'center',
		verticalAlign: 'middle',
		lineHeight: 1.25,
		letterSpacing: 0,
		wrap: 'word',
		ellipsis: false,
		autoFit: false,
		minFontSize: 12,
		...overrides
	};
}

export function createStarterTemplateState(
	defaultEventTitle = 'Event Name Here'
): TemplateCanvasState {
	return {
		version: 1,
		background: {
			color: '#ffffff'
		},
		elements: [
			makeRect({
				id: 'el-border-outer',
				name: 'Outer Border',
				x: 36,
				y: 36,
				width: 1051,
				height: 722,
				stroke: '#000000',
				strokeWidth: 4,
				cornerRadius: 4
			}),
			makeRect({
				id: 'el-border-inner',
				name: 'Inner Accent Border',
				x: 48,
				y: 48,
				width: 1027,
				height: 698,
				stroke: '#000000',
				strokeWidth: 1.5,
				cornerRadius: 2
			}),
			makeText({
				id: 'el-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Certificate of Participation',
				x: 112,
				y: 120,
				width: 900,
				height: 72,
				fontFamily: 'Georgia',
				fontSize: 44,
				fontWeight: 700,
				textTransform: 'uppercase',
				lineHeight: 1.2,
				letterSpacing: 3,
				autoFit: true,
				minFontSize: 22
			}),
			makeText({
				id: 'el-subtitle',
				name: 'Presented To Label',
				text: 'IS PROUDLY PRESENTED TO',
				x: 212,
				y: 235,
				width: 700,
				height: 36,
				fontFamily: 'Inter',
				fontSize: 16,
				fontWeight: 600,
				textTransform: 'uppercase',
				lineHeight: 1.2,
				letterSpacing: 4
			}),
			makeText({
				id: 'el-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 112,
				y: 295,
				width: 900,
				height: 96,
				fontFamily: 'Georgia',
				fontSize: 54,
				fontWeight: 700,
				fontStyle: 'italic',
				lineHeight: 1.15,
				letterSpacing: 0.5,
				autoFit: true,
				minFontSize: 24
			}),
			makeText({
				id: 'el-role-line',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 162,
				y: 425,
				width: 800,
				height: 44,
				fontFamily: 'Inter',
				fontSize: 20,
				lineHeight: 1.4,
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'el-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 132,
				y: 485,
				width: 860,
				height: 64,
				fontFamily: 'Georgia',
				fontSize: 30,
				fontWeight: 700,
				lineHeight: 1.3,
				letterSpacing: 0.5,
				autoFit: true,
				minFontSize: 18
			})
		]
	};
}

function createClassicAcademicState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#fdfbf7' },
		elements: [
			makeRect({
				id: 'ca-border-outer',
				name: 'Outer Navy Border',
				x: 32,
				y: 32,
				width: 1059,
				height: 730,
				stroke: '#1b2a4a',
				strokeWidth: 5
			}),
			makeRect({
				id: 'ca-border-inner',
				name: 'Inner Gold Border',
				x: 46,
				y: 46,
				width: 1031,
				height: 702,
				stroke: '#b8913a',
				strokeWidth: 1.5
			}),
			makeLine({
				id: 'ca-top-rule',
				name: 'Top Accent Rule',
				x: 482,
				y: 102,
				width: 160,
				stroke: '#b8913a',
				strokeWidth: 2
			}),
			makeText({
				id: 'ca-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Certificate of Achievement',
				x: 112,
				y: 122,
				width: 900,
				height: 74,
				fontFamily: 'Cinzel',
				fontSize: 44,
				fontWeight: 700,
				textTransform: 'uppercase',
				fill: '#1b2a4a',
				letterSpacing: 4,
				autoFit: true,
				minFontSize: 22
			}),
			makeText({
				id: 'ca-subtitle',
				name: 'Presented To Label',
				text: 'THIS CERTIFICATE IS PROUDLY PRESENTED TO',
				x: 212,
				y: 212,
				width: 700,
				height: 32,
				fontFamily: 'Montserrat',
				fontSize: 13,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 3.5
			}),
			makeText({
				id: 'ca-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 112,
				y: 262,
				width: 900,
				height: 106,
				fontFamily: 'Great Vibes',
				fontSize: 76,
				fontWeight: 400,
				fill: '#1b2a4a',
				lineHeight: 1.1,
				autoFit: true,
				minFontSize: 34
			}),
			makeLine({
				id: 'ca-name-rule',
				name: 'Name Underline',
				x: 312,
				y: 378,
				width: 500,
				stroke: '#b8913a',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'ca-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 162,
				y: 404,
				width: 800,
				height: 40,
				fontFamily: 'Lora',
				fontSize: 20,
				fontStyle: 'italic',
				fill: '#475569',
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'ca-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 132,
				y: 454,
				width: 860,
				height: 66,
				fontFamily: 'Playfair Display',
				fontSize: 30,
				fontWeight: 700,
				fill: '#1b2a4a',
				autoFit: true,
				minFontSize: 18
			}),
			makeCircle({
				id: 'ca-seal-outer',
				name: 'Gold Seal',
				x: 525,
				y: 584,
				width: 74,
				height: 74,
				fill: '#b8913a',
				stroke: '#1b2a4a',
				strokeWidth: 2
			}),
			makeCircle({
				id: 'ca-seal-inner',
				name: 'Seal Inner Ring',
				x: 533,
				y: 592,
				width: 58,
				height: 58,
				fill: 'transparent',
				stroke: '#fdfbf7',
				strokeWidth: 1.5
			}),
			makeLine({
				id: 'ca-sig-left',
				name: 'Left Signature Line',
				x: 180,
				y: 632,
				width: 240,
				stroke: '#1b2a4a',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'ca-sig-left-label',
				name: 'Left Signature Label',
				text: 'PROGRAMME DIRECTOR',
				x: 180,
				y: 644,
				width: 240,
				height: 28,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 2
			}),
			makeLine({
				id: 'ca-sig-right',
				name: 'Right Signature Line',
				x: 703,
				y: 632,
				width: 240,
				stroke: '#1b2a4a',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'ca-sig-right-label',
				name: 'Right Signature Label',
				text: 'DATE ISSUED',
				x: 703,
				y: 644,
				width: 240,
				height: 28,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 2
			})
		]
	};
}

function createModernExecutiveState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#ffffff' },
		elements: [
			makeRect({
				id: 'me-side-band',
				name: 'Navy Side Band',
				x: 0,
				y: 0,
				width: 112,
				height: 794,
				fill: '#0f172a',
				stroke: 'transparent',
				strokeWidth: 0
			}),
			makeRect({
				id: 'me-side-accent',
				name: 'Indigo Accent Stripe',
				x: 112,
				y: 0,
				width: 12,
				height: 794,
				fill: '#4f46e5',
				stroke: 'transparent',
				strokeWidth: 0
			}),
			makeText({
				id: 'me-eyebrow',
				name: 'Header Label',
				text: 'OFFICIAL CERTIFICATE',
				x: 196,
				y: 118,
				width: 560,
				height: 28,
				fontFamily: 'Montserrat',
				fontSize: 13,
				fontWeight: 700,
				textTransform: 'uppercase',
				fill: '#4f46e5',
				align: 'left',
				letterSpacing: 4
			}),
			makeText({
				id: 'me-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Certificate of Completion',
				x: 196,
				y: 154,
				width: 820,
				height: 86,
				fontFamily: 'Montserrat',
				fontSize: 44,
				fontWeight: 700,
				fill: '#0f172a',
				align: 'left',
				lineHeight: 1.15,
				autoFit: true,
				minFontSize: 24
			}),
			makeLine({
				id: 'me-accent-rule',
				name: 'Accent Divider',
				x: 196,
				y: 256,
				width: 96,
				stroke: '#4f46e5',
				strokeWidth: 4
			}),
			makeText({
				id: 'me-presented',
				name: 'Presented To Label',
				text: 'PRESENTED TO',
				x: 196,
				y: 294,
				width: 400,
				height: 26,
				fontFamily: 'Inter',
				fontSize: 13,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'left',
				letterSpacing: 3
			}),
			makeText({
				id: 'me-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 196,
				y: 326,
				width: 820,
				height: 92,
				fontFamily: 'Playfair Display',
				fontSize: 54,
				fontWeight: 700,
				fill: '#0f172a',
				align: 'left',
				lineHeight: 1.15,
				autoFit: true,
				minFontSize: 26
			}),
			makeText({
				id: 'me-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 196,
				y: 432,
				width: 760,
				height: 36,
				fontFamily: 'Inter',
				fontSize: 20,
				fontWeight: 500,
				fill: '#334155',
				align: 'left',
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'me-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 196,
				y: 476,
				width: 820,
				height: 56,
				fontFamily: 'Montserrat',
				fontSize: 24,
				fontWeight: 700,
				fill: '#1e293b',
				align: 'left',
				autoFit: true,
				minFontSize: 16
			}),
			makeLine({
				id: 'me-footer-rule',
				name: 'Footer Rule',
				x: 196,
				y: 616,
				width: 820,
				stroke: '#e2e8f0',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'me-footer-left',
				name: 'Left Footer Label',
				text: 'AUTHORISED SIGNATURE',
				x: 196,
				y: 642,
				width: 260,
				height: 24,
				fontFamily: 'Inter',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'left',
				letterSpacing: 2
			}),
			makeText({
				id: 'me-footer-right',
				name: 'Right Footer Label',
				text: 'ISSUED BY ORGANISER',
				x: 756,
				y: 642,
				width: 260,
				height: 24,
				fontFamily: 'Inter',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'right',
				letterSpacing: 2
			})
		]
	};
}

function createGoldGalaState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#111827' },
		elements: [
			makeRect({
				id: 'gg-border-outer',
				name: 'Outer Gold Border',
				x: 34,
				y: 34,
				width: 1055,
				height: 726,
				stroke: '#d4af37',
				strokeWidth: 3,
				cornerRadius: 2
			}),
			makeRect({
				id: 'gg-border-inner',
				name: 'Inner Gold Frame',
				x: 48,
				y: 48,
				width: 1027,
				height: 698,
				stroke: '#9a7b2c',
				strokeWidth: 1
			}),
			makeCircle({
				id: 'gg-emblem-outer',
				name: 'Gold Crest Ring',
				x: 531,
				y: 84,
				width: 62,
				height: 62,
				fill: 'transparent',
				stroke: '#d4af37',
				strokeWidth: 2
			}),
			makeCircle({
				id: 'gg-emblem-inner',
				name: 'Gold Crest Centre',
				x: 547,
				y: 100,
				width: 30,
				height: 30,
				fill: '#d4af37',
				stroke: 'transparent',
				strokeWidth: 0
			}),
			makeText({
				id: 'gg-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Certificate of Excellence',
				x: 112,
				y: 168,
				width: 900,
				height: 72,
				fontFamily: 'Cinzel',
				fontSize: 42,
				fontWeight: 700,
				textTransform: 'uppercase',
				fill: '#e5c158',
				letterSpacing: 4.5,
				autoFit: true,
				minFontSize: 22
			}),
			makeText({
				id: 'gg-subtitle',
				name: 'Subtitle',
				text: 'HONOURING THE ACHIEVEMENT OF',
				x: 212,
				y: 252,
				width: 700,
				height: 30,
				fontFamily: 'Montserrat',
				fontSize: 13,
				fontWeight: 500,
				textTransform: 'uppercase',
				fill: '#9ca3af',
				letterSpacing: 3.5
			}),
			makeText({
				id: 'gg-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 112,
				y: 298,
				width: 900,
				height: 100,
				fontFamily: 'Cormorant Garamond',
				fontSize: 66,
				fontWeight: 700,
				fontStyle: 'italic',
				fill: '#f9fafb',
				lineHeight: 1.1,
				autoFit: true,
				minFontSize: 30
			}),
			makeLine({
				id: 'gg-divider',
				name: 'Gold Divider',
				x: 362,
				y: 410,
				width: 400,
				stroke: '#d4af37',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'gg-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Award Honouree',
				x: 162,
				y: 432,
				width: 800,
				height: 40,
				fontFamily: 'Montserrat',
				fontSize: 18,
				fill: '#d1d5db',
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'gg-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 132,
				y: 484,
				width: 860,
				height: 60,
				fontFamily: 'Cinzel',
				fontSize: 26,
				fontWeight: 400,
				textTransform: 'uppercase',
				fill: '#f3f4f6',
				letterSpacing: 2,
				autoFit: true,
				minFontSize: 16
			}),
			makeLine({
				id: 'gg-sig-left',
				name: 'Left Signature Line',
				x: 200,
				y: 636,
				width: 230,
				stroke: '#d4af37',
				strokeWidth: 1
			}),
			makeText({
				id: 'gg-sig-left-label',
				name: 'Left Signature Label',
				text: 'CHAIRPERSON',
				x: 200,
				y: 648,
				width: 230,
				height: 24,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#9ca3af',
				letterSpacing: 2.5
			}),
			makeLine({
				id: 'gg-sig-right',
				name: 'Right Signature Line',
				x: 693,
				y: 636,
				width: 230,
				stroke: '#d4af37',
				strokeWidth: 1
			}),
			makeText({
				id: 'gg-sig-right-label',
				name: 'Right Signature Label',
				text: 'EVENT DIRECTOR',
				x: 693,
				y: 648,
				width: 230,
				height: 24,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#9ca3af',
				letterSpacing: 2.5
			})
		]
	};
}

function createMinimalistEditorialState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#fafafa' },
		elements: [
			makeRect({
				id: 'ed-border',
				name: 'Hairline Frame',
				x: 42,
				y: 42,
				width: 1039,
				height: 710,
				stroke: '#18181b',
				strokeWidth: 1.5
			}),
			makeLine({
				id: 'ed-top-rule',
				name: 'Top Accent Line',
				x: 492,
				y: 120,
				width: 140,
				stroke: '#18181b',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'ed-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Certificate of Participation',
				x: 112,
				y: 148,
				width: 900,
				height: 72,
				fontFamily: 'Playfair Display',
				fontSize: 44,
				fontWeight: 700,
				fill: '#18181b',
				letterSpacing: 1,
				autoFit: true,
				minFontSize: 22
			}),
			makeText({
				id: 'ed-subtitle',
				name: 'Awarded To Label',
				text: 'AWARDED TO',
				x: 262,
				y: 246,
				width: 600,
				height: 28,
				fontFamily: 'Inter',
				fontSize: 12,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#71717a',
				letterSpacing: 5
			}),
			makeText({
				id: 'ed-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 112,
				y: 292,
				width: 900,
				height: 96,
				fontFamily: 'Playfair Display',
				fontSize: 56,
				fontWeight: 400,
				fontStyle: 'italic',
				fill: '#09090b',
				lineHeight: 1.15,
				autoFit: true,
				minFontSize: 26
			}),
			makeText({
				id: 'ed-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 212,
				y: 412,
				width: 700,
				height: 36,
				fontFamily: 'Inter',
				fontSize: 18,
				fill: '#52525b',
				autoFit: true,
				minFontSize: 13
			}),
			makeText({
				id: 'ed-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 162,
				y: 462,
				width: 800,
				height: 56,
				fontFamily: 'Inter',
				fontSize: 22,
				fontWeight: 600,
				fill: '#18181b',
				autoFit: true,
				minFontSize: 15
			}),
			makeLine({
				id: 'ed-bottom-rule',
				name: 'Signature Rule',
				x: 412,
				y: 606,
				width: 300,
				stroke: '#a1a1aa',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'ed-footer-label',
				name: 'Signature Label',
				text: 'SIGNATURE & DATE',
				x: 412,
				y: 620,
				width: 300,
				height: 26,
				fontFamily: 'Inter',
				fontSize: 11,
				fontWeight: 500,
				textTransform: 'uppercase',
				fill: '#71717a',
				letterSpacing: 3
			})
		]
	};
}

function createTechHackathonState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#f8fafc' },
		elements: [
			makeRect({
				id: 'th-top-bar',
				name: 'Top Dark Bar',
				x: 0,
				y: 0,
				width: 1123,
				height: 20,
				fill: '#0f172a',
				stroke: 'transparent',
				strokeWidth: 0
			}),
			makeRect({
				id: 'th-top-accent',
				name: 'Blue Accent Bar',
				x: 0,
				y: 20,
				width: 360,
				height: 6,
				fill: '#2563eb',
				stroke: 'transparent',
				strokeWidth: 0
			}),
			makeRect({
				id: 'th-card',
				name: 'Content Card',
				x: 44,
				y: 56,
				width: 1035,
				height: 694,
				fill: '#ffffff',
				stroke: '#cbd5e1',
				strokeWidth: 1.5,
				cornerRadius: 8
			}),
			makeText({
				id: 'th-tag',
				name: 'Credential Tag',
				text: 'CERTIFICATE // VERIFIED CREDENTIAL',
				x: 108,
				y: 106,
				width: 560,
				height: 28,
				fontFamily: 'JetBrains Mono',
				fontSize: 13,
				fontWeight: 700,
				textTransform: 'uppercase',
				fill: '#2563eb',
				align: 'left',
				letterSpacing: 2
			}),
			makeText({
				id: 'th-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Hackathon Certificate',
				x: 108,
				y: 146,
				width: 907,
				height: 78,
				fontFamily: 'Space Grotesk',
				fontSize: 46,
				fontWeight: 700,
				fill: '#0f172a',
				align: 'left',
				lineHeight: 1.15,
				autoFit: true,
				minFontSize: 24
			}),
			makeLine({
				id: 'th-rule-top',
				name: 'Header Divider',
				x: 108,
				y: 244,
				width: 907,
				stroke: '#e2e8f0',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'th-recipient-label',
				name: 'Recipient Label',
				text: 'RECIPIENT',
				x: 108,
				y: 278,
				width: 300,
				height: 24,
				fontFamily: 'JetBrains Mono',
				fontSize: 12,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'left',
				letterSpacing: 2.5
			}),
			makeText({
				id: 'th-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 108,
				y: 308,
				width: 907,
				height: 88,
				fontFamily: 'Space Grotesk',
				fontSize: 54,
				fontWeight: 700,
				fill: '#0f172a',
				align: 'left',
				lineHeight: 1.15,
				autoFit: true,
				minFontSize: 26
			}),
			makeText({
				id: 'th-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 108,
				y: 410,
				width: 800,
				height: 36,
				fontFamily: 'Inter',
				fontSize: 20,
				fontWeight: 600,
				fill: '#2563eb',
				align: 'left',
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'th-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 108,
				y: 458,
				width: 907,
				height: 56,
				fontFamily: 'Inter',
				fontSize: 24,
				fontWeight: 600,
				fill: '#334155',
				align: 'left',
				autoFit: true,
				minFontSize: 16
			}),
			makeLine({
				id: 'th-footer-rule',
				name: 'Footer Divider',
				x: 108,
				y: 618,
				width: 907,
				stroke: '#e2e8f0',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'th-footer-left',
				name: 'Lead Organiser Label',
				text: 'LEAD ORGANISER',
				x: 108,
				y: 642,
				width: 280,
				height: 24,
				fontFamily: 'JetBrains Mono',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'left',
				letterSpacing: 1.5
			}),
			makeText({
				id: 'th-footer-right',
				name: 'Credential Footer',
				text: 'VERIFIED CREDENTIAL',
				x: 735,
				y: 642,
				width: 280,
				height: 24,
				fontFamily: 'JetBrains Mono',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				align: 'right',
				letterSpacing: 1.5
			})
		]
	};
}

function createPortraitDiplomaState(defaultEventTitle = 'Event Name Here'): TemplateCanvasState {
	return {
		version: 1,
		background: { color: '#fbf9f4' },
		elements: [
			makeRect({
				id: 'pd-border-outer',
				name: 'Outer Burgundy Border',
				x: 34,
				y: 34,
				width: 726,
				height: 1055,
				stroke: '#6b1d2a',
				strokeWidth: 5
			}),
			makeRect({
				id: 'pd-border-inner',
				name: 'Inner Gold Border',
				x: 48,
				y: 48,
				width: 698,
				height: 1027,
				stroke: '#b08d42',
				strokeWidth: 1.5
			}),
			makeCircle({
				id: 'pd-seal-outer',
				name: 'Burgundy Crest',
				x: 355,
				y: 108,
				width: 84,
				height: 84,
				fill: '#6b1d2a',
				stroke: '#b08d42',
				strokeWidth: 2.5
			}),
			makeCircle({
				id: 'pd-seal-inner',
				name: 'Crest Inner Ring',
				x: 365,
				y: 118,
				width: 64,
				height: 64,
				fill: 'transparent',
				stroke: '#fbf9f4',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'pd-ranking',
				name: 'Rank',
				text: '{{rank}}',
				fallbackText: 'Diploma of Honour',
				x: 87,
				y: 236,
				width: 620,
				height: 88,
				fontFamily: 'Cinzel',
				fontSize: 40,
				fontWeight: 700,
				textTransform: 'uppercase',
				fill: '#6b1d2a',
				letterSpacing: 3.5,
				autoFit: true,
				minFontSize: 20
			}),
			makeLine({
				id: 'pd-divider',
				name: 'Gold Divider',
				x: 297,
				y: 344,
				width: 200,
				stroke: '#b08d42',
				strokeWidth: 2
			}),
			makeText({
				id: 'pd-subtitle',
				name: 'Certify Label',
				text: 'THIS IS TO CERTIFY THAT',
				x: 117,
				y: 382,
				width: 560,
				height: 32,
				fontFamily: 'Montserrat',
				fontSize: 13,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 3.5
			}),
			makeText({
				id: 'pd-recipient-name',
				name: 'Recipient Name',
				text: '{{name}}',
				fallbackText: 'Recipient Full Name',
				x: 87,
				y: 438,
				width: 620,
				height: 116,
				fontFamily: 'Great Vibes',
				fontSize: 72,
				fontWeight: 400,
				fill: '#1f2937',
				lineHeight: 1.1,
				autoFit: true,
				minFontSize: 32
			}),
			makeLine({
				id: 'pd-name-rule',
				name: 'Name Underline',
				x: 177,
				y: 566,
				width: 440,
				stroke: '#b08d42',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'pd-role',
				name: 'Role',
				text: '{{role}}',
				fallbackText: 'Participant',
				x: 117,
				y: 602,
				width: 560,
				height: 44,
				fontFamily: 'Lora',
				fontSize: 21,
				fontStyle: 'italic',
				fill: '#4b5563',
				autoFit: true,
				minFontSize: 14
			}),
			makeText({
				id: 'pd-event-title',
				name: 'Event Title',
				text: '{{title}}',
				fallbackText: defaultEventTitle,
				x: 97,
				y: 668,
				width: 600,
				height: 80,
				fontFamily: 'Playfair Display',
				fontSize: 30,
				fontWeight: 700,
				fill: '#6b1d2a',
				autoFit: true,
				minFontSize: 18
			}),
			makeLine({
				id: 'pd-sig-left',
				name: 'Left Signature Line',
				x: 112,
				y: 924,
				width: 210,
				stroke: '#6b1d2a',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'pd-sig-left-label',
				name: 'Left Signature Label',
				text: 'DIRECTOR',
				x: 112,
				y: 938,
				width: 210,
				height: 24,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 2
			}),
			makeLine({
				id: 'pd-sig-right',
				name: 'Right Signature Line',
				x: 472,
				y: 924,
				width: 210,
				stroke: '#6b1d2a',
				strokeWidth: 1.5
			}),
			makeText({
				id: 'pd-sig-right-label',
				name: 'Right Signature Label',
				text: 'DATE',
				x: 472,
				y: 938,
				width: 210,
				height: 24,
				fontFamily: 'Montserrat',
				fontSize: 11,
				fontWeight: 600,
				textTransform: 'uppercase',
				fill: '#64748b',
				letterSpacing: 2
			})
		]
	};
}

export const STARTER_TEMPLATE_PRESETS: StarterTemplatePreset[] = [
	{
		id: 'classic-academic',
		name: 'Classic Academic',
		styleTag: 'Navy & gold',
		width: 1123,
		height: 794,
		createState: createClassicAcademicState
	},
	{
		id: 'modern-executive',
		name: 'Modern Executive',
		styleTag: 'Left sidebar',
		width: 1123,
		height: 794,
		createState: createModernExecutiveState
	},
	{
		id: 'gold-gala',
		name: 'Gold Gala Award',
		styleTag: 'Dark & gold',
		width: 1123,
		height: 794,
		createState: createGoldGalaState
	},
	{
		id: 'minimalist-editorial',
		name: 'Minimalist Editorial',
		styleTag: 'Clean monochrome',
		width: 1123,
		height: 794,
		createState: createMinimalistEditorialState
	},
	{
		id: 'tech-hackathon',
		name: 'Tech & Hackathon',
		styleTag: 'Modern grid',
		width: 1123,
		height: 794,
		createState: createTechHackathonState
	},
	{
		id: 'portrait-diploma',
		name: 'Formal Diploma',
		styleTag: 'A4 Portrait',
		width: 794,
		height: 1123,
		createState: createPortraitDiplomaState
	}
];
