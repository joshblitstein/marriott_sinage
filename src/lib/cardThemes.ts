import type { CardTheme, CardThemeId } from '../types/templates';

const SERIF = "var(--font-serif), 'Fraunces', 'Times New Roman', serif";
const SANS = "var(--font-sans), 'Source Sans 3', 'Segoe UI', sans-serif";

/**
 * Built-in themes from Sheraton Brand Book 2025 §3.3.
 * Preferred light colorway: Warm Tungsten / Graphite on Oyster.
 * Dark: Oyster on Graphite. Mid: Oyster on French Gray.
 */
export const CARD_THEMES: Record<CardThemeId, CardTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic Oyster',
    description: 'Warm Tungsten on Oyster — primary Core & Grand colorway.',
    background: '#efeae4',
    surface: '#f7f3ee',
    ink: '#6f625d',
    muted: '#878686',
    accent: '#6f625d',
    line: 'rgba(111, 98, 93, 0.22)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-tungsten.png',
  },
  cards: {
    id: 'cards',
    name: 'Cards Panel',
    description: 'Oyster field with soft panels — Graphite body, Tungsten headlines.',
    background: '#efeae4',
    surface: '#ffffff',
    ink: '#3a3a3a',
    muted: '#878686',
    accent: '#6f625d',
    line: 'rgba(111, 98, 93, 0.14)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-tungsten.png',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Graphite Night',
    description: 'Oyster type on Graphite — preferred dark background.',
    background: '#3a3a3a',
    surface: '#454545',
    ink: '#efeae4',
    muted: '#c9c3be',
    accent: '#efeae4',
    line: 'rgba(239, 234, 228, 0.22)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-oyster.png',
  },
  'oyster-bold': {
    id: 'oyster-bold',
    name: 'Oyster Bold',
    description: 'High-contrast display on Oyster with Lilac accent rules.',
    background: '#efeae4',
    surface: '#e5dfd6',
    ink: '#3a3a3a',
    muted: '#6f625d',
    accent: '#beadd1',
    line: 'rgba(58, 58, 58, 0.2)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-tungsten.png',
  },
  steel: {
    id: 'steel',
    name: 'French Gray',
    description: 'Oyster type on French Gray — mid-tone brand field.',
    background: '#878686',
    surface: '#949494',
    ink: '#efeae4',
    muted: '#f5f1ec',
    accent: '#efeae4',
    line: 'rgba(239, 234, 228, 0.28)',
    fontDisplay: SERIF,
    fontBody: SANS,
    logoSrc: '/brand/sheraton-logo-oyster.png',
  },
};

export const CARD_THEME_LIST = Object.values(CARD_THEMES);

export function themeById(id: CardThemeId | string | undefined): CardTheme {
  if (id && id in CARD_THEMES) return CARD_THEMES[id as CardThemeId];
  return CARD_THEMES.classic;
}
