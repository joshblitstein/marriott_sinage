import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type {
  ImportSummary,
  Organization,
  Room,
  SignageEvent,
} from '../../types';
import {
  orgIdForRow,
  parseCityRows,
  stableEventId,
  type CityRawRow,
  DEFAULT_NON_DISPLAY_TYPES,
} from './parse';
import { rebuildRoomDisplaysForDate } from '../schedule';
import { dateKeyInHotelTz } from '../time';

const CHUNK = 400;

/**
 * Idempotent CITY import into Firestore.
 * Upserts orgs + events; deletes vanished CITY events for touched date keys;
 * never touches source:"manual" events.
 */
export async function importCityRows(
  db: Firestore,
  rawRows: CityRawRow[],
  options?: {
    nonDisplayFunctionTypes?: string[];
    /** Month imports skip rebuilding every day — only refresh hotel-today displays. */
    rebuildDisplays?: 'all' | 'today' | 'none';
  },
): Promise<ImportSummary> {
  const roomsSnap = await getDocs(collection(db, 'rooms'));
  const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Room[];

  const parsed = parseCityRows(
    rawRows,
    rooms,
    options?.nonDisplayFunctionTypes ?? DEFAULT_NON_DISPLAY_TYPES,
  );

  const orgsSnap = await getDocs(collection(db, 'organizations'));
  const orgsByNormalized = new Map<string, Organization>();
  for (const d of orgsSnap.docs) {
    const org = { id: d.id, ...d.data() } as Organization;
    orgsByNormalized.set(org.normalizedName, org);
  }

  const now = new Date().toISOString();
  const eventDocs: SignageEvent[] = [];
  const orgWrites = new Map<string, Organization>();
  const dateKeys = new Set<string>();

  for (const row of parsed.rows) {
    dateKeys.add(row.dateKey);
    let org = orgsByNormalized.get(row.orgNormalized);
    if (!org) {
      const id = orgIdForRow(row.orgNormalized);
      org = {
        id,
        name: row.orgDisplayName,
        displayName: row.orgDisplayName,
        normalizedName: row.orgNormalized,
        aliases: [],
        logoUrl: null,
        createdAt: now,
      };
      orgsByNormalized.set(row.orgNormalized, org);
      orgWrites.set(id, org);
    } else if (!orgWrites.has(org.id)) {
      // keep existing
    }

    for (const roomId of row.roomIds) {
      const id = stableEventId(
        row.orderNumber,
        roomId,
        row.dateKey,
        row.startTime,
      );
      eventDocs.push({
        id,
        roomId,
        orgId: org.id,
        orgNameRaw: row.quoteName,
        title: row.title,
        startTime: row.startTime,
        endTime: row.endTime,
        functionType: row.functionType,
        source: 'city',
        display: row.display,
        orderNumber: row.orderNumber,
        dateKey: row.dateKey,
        updatedAt: now,
      });
    }
  }

  // Write orgs
  await commitChunks(db, [...orgWrites.values()].map((org) => ({
    path: `organizations/${org.id}`,
    data: org,
  })));

  // Upsert events
  await commitChunks(
    db,
    eventDocs.map((ev) => ({ path: `events/${ev.id}`, data: ev })),
  );

  // Delete CITY (and legacy Delphi) events for touched dates that vanished
  let deleted = 0;
  const keepIds = new Set(eventDocs.map((e) => e.id));
  for (const dateKey of dateKeys) {
    const q = query(collection(db, 'events'), where('dateKey', '==', dateKey));
    const snap = await getDocs(q);
    const toDelete = snap.docs.filter((d) => {
      const source = d.data().source as string;
      if (source === 'manual') return false;
      if (source !== 'city' && source !== 'delphi') return false;
      return !keepIds.has(d.id);
    });
    deleted += toDelete.length;
    await commitDeletes(
      db,
      toDelete.map((d) => `events/${d.id}`),
    );
  }

  const rebuildMode = options?.rebuildDisplays ?? 'all';
  if (rebuildMode === 'all') {
    const rebuildDates = [...dateKeys].sort();
    for (const dateKey of rebuildDates) {
      await rebuildRoomDisplaysForDate(db, dateKey);
    }
  } else if (rebuildMode === 'today') {
    await rebuildRoomDisplaysForDate(db, dateKeyInHotelTz());
  }

  const orgsWithoutLogo = [...orgsByNormalized.values()]
    .filter((o) => !o.logoUrl)
    .filter((o) => eventDocs.some((e) => e.orgId === o.id))
    .map((o) => ({ id: o.id, name: o.displayName }));

  return {
    imported: eventDocs.length,
    updated: eventDocs.length,
    deleted,
    skipped: parsed.skipped,
    unmatchedSpaces: parsed.unmatchedSpaces,
    orgsWithoutLogo,
  };
}

async function commitChunks(
  db: Firestore,
  items: { path: string; data: object }[],
) {
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + CHUNK)) {
      const [col, id] = item.path.split('/');
      batch.set(doc(db, col, id), item.data, { merge: true });
    }
    await batch.commit();
  }
}

async function commitDeletes(db: Firestore, paths: string[]) {
  for (let i = 0; i < paths.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const path of paths.slice(i, i + CHUNK)) {
      const [col, id] = path.split('/');
      batch.delete(doc(db, col, id));
    }
    await batch.commit();
  }
}
