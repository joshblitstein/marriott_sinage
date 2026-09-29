/** Official Sheraton brand marks (web solid, from Marriott SH brand logo pack). */

export const BRAND_LOGO = {
  /** Crest + wordmark — Warm Tungsten on light / Oyster fields */
  tungsten: '/brand/sheraton-logo-tungsten.png',
  /** Crest + wordmark — Oyster on Graphite / French Gray / dark fields */
  oyster: '/brand/sheraton-logo-oyster.png',
  graphite: '/brand/sheraton-logo-graphite.png',
  frenchGray: '/brand/sheraton-logo-french-gray.png',
} as const;

export const BRAND_CREST = {
  tungsten: '/brand/sheraton-crest-tungsten.png',
  oyster: '/brand/sheraton-crest-oyster.png',
} as const;

export const BRAND_WORDMARK = {
  tungsten: '/brand/sheraton-wordmark-tungsten.png',
  oyster: '/brand/sheraton-wordmark-oyster.png',
} as const;

/** Default lockup for oyster / light signage */
export const SHERATON_LOGO = BRAND_LOGO.tungsten;
/** Lockup for charcoal / steel themes */
export const SHERATON_LOGO_ON_DARK = BRAND_LOGO.oyster;
