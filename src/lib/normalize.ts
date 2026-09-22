/** Name / org normalization helpers for CITY matching */

const MONTH_YEAR_SUFFIX =
  /\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s*\d{2,4}\s*$/i;

const CORP_SUFFIX = /\b(inc|llc|corp|ltd|co|incorporated|company)\.?$/i;

/** Normalize booking-space names for alias lookup */
export function normalizeSpaceName(raw: string): string {
  let s = String(raw ?? '').trim().toLowerCase();
  // Strip trailing "- …" annotations (e.g. "Symphony 1, 2 & 3 - Place in FOYER")
  const dash = s.search(/\s[-–—]\s/);
  if (dash !== -1) s = s.slice(0, dash);
  s = s.replace(/\band\b/g, ',');
  s = s.replace(/&/g, ',');
  s = s.replace(/[^a-z0-9,\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*,\s*/g, ',');
  s = s.replace(/,+/g, ',');
  return s;
}

/** Normalize organization names for matching */
export function normalizeOrgName(raw: string): string {
  let s = String(raw ?? '').trim();
  s = s.replace(MONTH_YEAR_SUFFIX, '');
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(CORP_SUFFIX, '').trim();
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Strip month-year token from Quote Name for display base name */
export function stripOrgMonthYear(raw: string): string {
  return String(raw ?? '').replace(MONTH_YEAR_SUFFIX, '').trim();
}

export function orgIdFromNormalized(normalized: string): string {
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
}

export function monogramInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic pastel from string */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 42% 42%)`;
}
