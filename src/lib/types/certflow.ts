export type BuiltInCriterionKey = 'name' | 'title' | 'role' | 'rank' | 'ranking' | 'email';

export interface CriterionDefinition {
	key: string;
	label: string;
	builtIn?: boolean;
	required?: boolean;
	defaultValue?: string;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type TextWrapMode = 'word' | 'char' | 'none';
export type TextTransformMode = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface BaseCanvasElement {
	id: string;
	name: string;
	/** Optional shared group identifier linking elements so they select, move and resize together. */
	groupId?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	visible: boolean;
	locked: boolean;
}

export interface TextTypography {
	fontFamily: string;
	fontSize: number;
	fontWeight: number;
	fontStyle: 'normal' | 'italic';
	textDecoration: '' | 'underline' | 'line-through';
	textTransform: TextTransformMode;
	fill: string;
	align: TextAlign;
	verticalAlign: VerticalAlign;
	lineHeight: number;
	letterSpacing: number;
	wrap: TextWrapMode;
	ellipsis: boolean;
	autoFit: boolean;
	minFontSize: number;
}

export interface PlaceholderCanvasElement extends BaseCanvasElement, TextTypography {
	type: 'placeholder';
	criterionKey: string;
	/** Shown if the recipient's value for this criterion is empty (e.g. "Certificate of Participation"). */
	fallbackText: string;
	/** Optional prefix/suffix rendered only when a value is present. */
	prefix?: string;
	suffix?: string;
}

export interface StaticTextCanvasElement extends BaseCanvasElement, TextTypography {
	type: 'text';
	text: string;
	/** Optional default text used when a {{property}} inside `text` is empty (e.g. "Certificate of Participation"). */
	fallbackText?: string;
	/** Optional conditional rules that override `text` when a recipient matches (most specific rule wins). */
	rules?: TitleBindingRule[];
}

export type TitleRuleOperator = 'equals' | 'not_empty' | 'is_empty';

export interface TitleRuleCondition {
	propertyKey: string;
	operator: TitleRuleOperator;
	value: string;
}

export interface TitleBindingRule {
	id: string;
	conditions: TitleRuleCondition[];
	output: string;
}

export interface TitleCanvasElement extends BaseCanvasElement, TextTypography {
	type: 'title';
	/** Shown when no conditional binding rule matches (e.g. "Certificate of Appreciation"). */
	defaultTitle: string;
	/** Conditional rules evaluated by highest specificity (most matching conditions wins). */
	rules: TitleBindingRule[];
}

export interface ImageEditState {
	rotation: number;
	crop: { x: number; y: number; width: number; height: number };
	outputWidth: number;
	outputHeight: number;
	aspectPreset?: 'free' | 'certificate' | '1:1' | '4:3' | '16:9';
}

export interface ImageCanvasElement extends BaseCanvasElement {
	type: 'image';
	assetId?: string;
	src: string;
	originalAssetId?: string;
	originalSrc?: string;
	editState?: ImageEditState;
	keepAspectRatio: boolean;
}

export interface SignatureCanvasElement extends BaseCanvasElement {
	type: 'signature';
	assetId?: string;
	src: string;
	originalAssetId?: string;
	originalSrc?: string;
	editState?: ImageEditState;
	keepAspectRatio: boolean;
}

export interface ShapeCanvasElement extends BaseCanvasElement {
	type: 'shape';
	shapeKind: 'rect' | 'circle' | 'line';
	fill: string;
	stroke: string;
	strokeWidth: number;
	cornerRadius?: number;
}

export type CanvasElement =
	| PlaceholderCanvasElement
	| StaticTextCanvasElement
	| TitleCanvasElement
	| ImageCanvasElement
	| SignatureCanvasElement
	| ShapeCanvasElement;

export interface TemplateBackground {
	color: string;
	assetId?: string;
	imageUrl?: string;
	originalAssetId?: string;
	originalImageUrl?: string;
	editState?: ImageEditState;
	fit?: 'cover' | 'contain' | 'stretch';
}

export interface TemplateCanvasState {
	version: 1;
	background: TemplateBackground;
	elements: CanvasElement[];
}

export type TemplateRankingRuleMode = 'any' | 'has_ranking' | 'no_ranking' | 'specific_rankings';

export interface TemplateRankingRule {
	mode: TemplateRankingRuleMode;
	values?: string[];
	/** Per-property filters from the vertical property checklist. Empty array = require non-empty; values = match any. */
	propertyFilters?: Record<string, string[]>;
}

export type ExportFormat = 'pdf' | 'png' | 'jpg';

export type EmailSenderMode = 'account' | 'custom_reply_to' | 'profile';

export interface ProjectEmailDefaults {
	senderMode?: EmailSenderMode;
	senderProfileId?: string | null;
	customSenderName?: string;
	customSenderEmail?: string;
	subjectTemplate: string;
	bodyTemplate: string;
	attachmentFormat: ExportFormat;
}

export type ColumnMapping = Record<string, string>; // criterionKey -> spreadsheet column header
