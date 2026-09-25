import type { CardTheme, CardThemeId } from '../types/templates';

const SERIF = "var(--font-serif), 'Libre Baskerville', Georgia, serif";
const SANS = "var(--font-sans), 'DM Sans', 'Segoe UI', sans-serif";

/** Built-in themes — classic + cards match existing door designs; three more from brand book. */
export const CARD_THEMES: Record<CardThemeId, CardTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic Oyster',
    description: 'Warm Tungsten on Oyster — primary brand colorway (existing classic door).',
    background: '#ede8e2',
    surface: '#f7f3ee',
    ink: '#3a3432',
    muted: '#6e655f',
    accent: '#3a3432',
    line: 'rgba(58, 52, 50, 0.18)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo.svg',
  },
  cards: {
    id: 'cards',
    name: 'Cards Panel',
    description: 'Oyster field with soft panels — existing card door layout.',
    background: '#ede8e2',
    surface: '#ffffff',
    ink: '#3a3432',
    muted: '#6e655f',
    accent: '#3a3432',
    line: 'rgba(58, 52, 50, 0.12)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo.svg',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal Night',
    description: 'Oyster type on charcoal — brand book dark background.',
    background: '#3a3a3a',
    surface: '#454545',
    ink: '#ede8e2',
    muted: '#c9c3be',
    accent: '#ede8e2',
    line: 'rgba(237, 232, 226, 0.2)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-oyster.svg',
  },
  'oyster-bold': {
    id: 'oyster-bold',
    name: 'Oyster Bold',
    description: 'High-contrast serif headlines on oyster with tungsten rules.',
    background: '#ede8e2',
    surface: '#e2dbd3',
    ink: '#2a2422',
    muted: '#6e655f',
    accent: '#726060',
    line: 'rgba(42, 36, 34, 0.22)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo.svg',
  },
  steel: {
    id: 'steel',
    name: 'Steel Gray',
    description: 'Cool steel field with oyster type — brand book mid gray.',
    background: '#868686',
    surface: '#949494',
    ink: '#ede8e2',
    muted: '#f5f1ec',
    accent: '#ede8e2',
    line: 'rgba(237, 232, 226, 0.28)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-oyster.svg',
  },
};

export const CARD_THEME_LIST = Object.values(CARD_THEMES);

export function themeById(id: CardThemeId | string | undefined): CardTheme {
  if (id && id in CARD_THEMES) return CARD_THEMES[id as CardThemeId];
  return CARD_THEMES.classic;
}
