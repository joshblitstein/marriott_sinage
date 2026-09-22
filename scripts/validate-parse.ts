import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseCityRows } from '../src/lib/city/parse';
import { buildRoomSeeds, resolveRoomsForSpace } from '../src/lib/roomsSeed';

const buf = readFileSync('sample-data/CI_Output_for_Readerboard_Data.xlsx');
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  defval: '',
}) as Record<string, unknown>[];
const rooms = buildRoomSeeds();
const parsed = parseCityRows(rows, rooms);

console.log('skipped', parsed.skipped);
console.log('unmatched', parsed.unmatchedSpaces);

const byRoom: Record<string, string[]> = {};
for (const r of parsed.rows) {
  if (!r.display) continue;
  for (const id of r.roomIds) {
    (byRoom[id] ??= []).push(`${r.title} | ${r.orgDisplayName}`);
  }
}

for (const id of [
  'symphony-1',
  'symphony-2',
  'symphony-3',
  'symphony-4',
  'symphony-5',
  'symphony-6',
  'mecklenburg-1',
  'mecklenburg-2',
  'mecklenburg-3',
  'symphony-foyer',
  'carolina-mecklenburg-foyer',
]) {
  console.log(id, byRoom[id] ?? '(none)');
}

console.log('non-display:');
for (const r of parsed.rows.filter((x) => !x.display)) {
  console.log(' ', r.title, r.functionType, r.spaceRaw);
}

for (const name of [
  'Symphony 1, 2 & 3',
  'Symphony 5 & 6',
  'Symphony 4',
  'Mecklenburg Ballroom',
  'Symphony Convention Foyer',
  'Mecklenburg Ballroom Foyer',
]) {
  console.log(name, '->', resolveRoomsForSpace(name, rooms));
}
