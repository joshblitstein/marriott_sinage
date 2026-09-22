import { createHash } from '../hash';
import {
  normalizeOrgName,
  normalizeSpaceName,
  orgIdFromNormalized,
  stripOrgMonthYear,
} from '../normalize';
import { resolveRoomsForSpace, type RoomSeed } from '../roomsSeed';
import {
  combineDateAndExcelTime,
  excelDateToDateKey,
} from '../time';

export type CityRawRow = Record<string, unknown>;

export type ParsedBookingRow = {
  orderNumber: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  spaceRaw: string;
  spaceNormalized: string;
  roomIds: string[];
  quoteName: string;
  orgDisplayName: string;
  orgNormalized: string;
  title: string;
  functionType: string;
  display: boolean;
  skipReason?: string;
};

export type ParseResult = {
  rows: ParsedBookingRow[];
  skipped: { reason: string; count: number }[];
  unmatchedSpaces: string[];
};

const DEFAULT_NON_DISPLAY_TYPES = [
  'Break',
  'Box Lunch',
  'Lunch Buffet',
  'Breakfast',
  'Breakfast Buffet',
  'Coffee Break',
  'Refreshment Break',
];

const SERVICE_SIGNAGE = new Set([
  'break',
  'box lunch',
  'coffee',
  'coffee break',
  'refreshment',
  'refreshment break',
  'registration',
  'lunch buffet',
  'breakfast',
]);

export function stableEventId(
  orderNumber: string,
  roomId: string,
  dateKey: string,
  startTime: string,
): string {
  const startKey = startTime.slice(11, 16); // HH:MM from ISO-ish
  const material = `${orderNumber}|${roomId}|${dateKey}|${startKey}`;
  return createHash(material).slice(0, 28);
}

function cell(row: CityRawRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function shouldDisplay(
  functionType: string,
  title: string,
  nonDisplayTypes: string[],
): boolean {
  const type = functionType.trim();
  if (!nonDisplayTypes.includes(type)) return true;
  // CITY sometimes labels primary meetings as Break — keep if signage looks real
  const sig = title.trim().toLowerCase();
  if (sig && !SERVICE_SIGNAGE.has(sig)) return true;
  return false;
}

/**
 * Parse CITY Readerboard rows (already JSON-ified from xlsx/csv).
 * Does not touch Firestore.
 */
export function parseCityRows(
  rawRows: CityRawRow[],
  rooms: Pick<RoomSeed, 'id' | 'bookingAliases'>[],
  nonDisplayTypes: string[] = DEFAULT_NON_DISPLAY_TYPES,
): ParseResult {
  const skippedMap = new Map<string, number>();
  const bump = (reason: string) =>
    skippedMap.set(reason, (skippedMap.get(reason) ?? 0) + 1);

  const unmatched = new Set<string>();
  const rows: ParsedBookingRow[] = [];

  for (const raw of rawRows) {
    const status = String(cell(raw, 'Function Status')).trim();
    if (status && status.toLowerCase() !== 'definite') {
      bump('Not Definite');
      continue;
    }

    const dnp = String(cell(raw, 'Do Not Post')).trim().toUpperCase();
    if (dnp === 'Y' || dnp === 'YES' || dnp === 'TRUE' || dnp === '1') {
      bump('Do Not Post');
      continue;
    }

    const sub = String(cell(raw, 'Sub Function')).trim().toUpperCase();
    if (sub === 'Y' || sub === 'YES' || sub === 'TRUE' || sub === '1') {
      bump('Sub Function');
      continue;
    }

    const spaceRaw = String(
      cell(raw, 'Function Space/Location', 'Function Space'),
    ).trim();
    if (!spaceRaw) {
      bump('Missing space');
      continue;
    }

    const dateVal = cell(raw, 'Date');
    const startVal = cell(raw, 'Start Time');
    const endVal = cell(raw, 'End Time');
    if (!dateVal || startVal === '' || endVal === '') {
      bump('Missing date/time');
      continue;
    }

    const dateKey = excelDateToDateKey(dateVal as Date | string | number);
    const startTime = combineDateAndExcelTime(
      dateKey,
      startVal as Date | string | number,
    );
    const endTime = combineDateAndExcelTime(
      dateKey,
      endVal as Date | string | number,
    );

    const quoteName = String(cell(raw, 'Quote Name')).trim();
    const postAs = String(cell(raw, 'Quote Post As Name')).trim();
    const orgBase = stripOrgMonthYear(quoteName) || quoteName;
    const orgDisplayName = postAs || orgBase;
    const orgNormalized = normalizeOrgName(orgDisplayName || quoteName);

    const title =
      String(cell(raw, 'Post As/Signage')).trim() ||
      String(cell(raw, 'Function Type')).trim() ||
      'Event';
    const functionType = String(cell(raw, 'Function Type')).trim() || 'Event';
    const orderNumber = String(cell(raw, 'Order #')).trim() || 'unknown';

    const roomIds = resolveRoomsForSpace(spaceRaw, rooms);
    if (roomIds.length === 0) {
      unmatched.add(spaceRaw.replace(/\s[-–—].*$/, '').trim() || spaceRaw);
      bump('Unmatched space');
      continue;
    }

    const display = shouldDisplay(functionType, title, nonDisplayTypes);

    rows.push({
      orderNumber,
      dateKey,
      startTime,
      endTime,
      spaceRaw,
      spaceNormalized: normalizeSpaceName(spaceRaw),
      roomIds,
      quoteName,
      orgDisplayName,
      orgNormalized,
      title,
      functionType,
      display,
    });
  }

  return {
    rows,
    skipped: [...skippedMap.entries()].map(([reason, count]) => ({
      reason,
      count,
    })),
    unmatchedSpaces: [...unmatched].sort(),
  };
}

export function orgIdForRow(orgNormalized: string): string {
  return orgIdFromNormalized(orgNormalized);
}

export { DEFAULT_NON_DISPLAY_TYPES };
