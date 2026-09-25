/** Room card template system — types */

export type CardThemeId =
  | 'classic'
  | 'cards'
  | 'charcoal'
  | 'oyster-bold'
  | 'steel';

export type TemplateElementKind =
  | 'brand'
  | 'level'
  | 'clock'
  | 'roomName'
  | 'orgLogo'
  | 'orgName'
  | 'eventTitle'
  | 'timeRange'
  | 'nextUp'
  | 'scheduleList'
  | 'footer'
  | 'customText'
  | 'image';

/** Bounding box in % of the 1920×1080 canvas (0–100). */
export type TemplateBox = {
  id: string;
  kind: TemplateElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
  /** Custom text / image URL */
  content?: string;
  imageUrl?: string;
  textAlign?: 'left' | 'center' | 'right';
  /** Base font size in px at 1080p canvas height */
  fontSize?: number;
  fontWeight?: number;
  /** Hide element without deleting */
  hidden?: boolean;
};

export type TemplateLayout = {
  elements: TemplateBox[];
  updatedAt: string;
};

export type CardTemplate = {
  id: string;
  name: string;
  themeId: CardThemeId;
  draft: TemplateLayout;
  published: TemplateLayout | null;
  previousPublished: TemplateLayout | null;
  /** When true, used as global default if set in settings (or first published). */
  isGlobalDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CardTheme = {
  id: CardThemeId;
  name: string;
  description: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  fontDisplay: string;
  fontBody: string;
  logoSrc: string;
};

/** Sample payload for editor live preview */
export type TemplatePreviewData = {
  roomName: string;
  level: string;
  orgDisplayName: string;
  logoUrl: string | null;
  eventTitle: string;
  timeRange: string;
  nextUp: string;
  scheduleLines: string[];
  footerLeft: string;
  footerRight: string;
  nowClock: string;
  nowDate: string;
};
