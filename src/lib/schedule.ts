import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type {
  DisplayEventSnapshot,
  Organization,
  Room,
  SignageEvent,
} from '../types';
import { dateKeyInHotelTz, hotelNowOnDate } from './time';

/**
 * Rebuild each room's embedded schedule fields for a given date.
 * Stored on `rooms/{id}` — tablets listen to a single room document.
 */
export async function rebuildRoomDisplaysForDate(
  db: Firestore,
  dateKey: string,
) {
  const [roomsSnap, eventsSnap, orgsSnap] = await Promise.all([
    getDocs(collection(db, 'rooms')),
    getDocs(query(collection(db, 'events'), where('dateKey', '==', dateKey))),
    getDocs(collection(db, 'organizations')),
  ]);

  const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Room[];
  const events = eventsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as SignageEvent,
  );
  const orgs = new Map(
    orgsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Organization]),
  );

  const now = new Date().toISOString();

  for (const room of rooms) {
    const roomEvents = events
      .filter((e) => e.roomId === room.id && e.display !== false)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    const resolved = preferManualOverlaps(roomEvents);

    const snapshots: DisplayEventSnapshot[] = resolved.map((e) => {
      const org = e.orgId ? orgs.get(e.orgId) : undefined;
      return {
        id: e.id,
        orgId: e.orgId,
        orgName: e.orgNameRaw,
        orgDisplayName: org?.displayName ?? e.orgNameRaw,
        logoUrl: org?.logoUrl ?? null,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        functionType: e.functionType,
        source: e.source,
        display: e.display,
      };
    });

    await setDoc(
      doc(db, 'rooms', room.id),
      {
        scheduleDateKey: dateKey,
        scheduleEvents: snapshots,
        scheduleUpdatedAt: now,
      },
      { merge: true },
    );
  }
}

function preferManualOverlaps(events: SignageEvent[]): SignageEvent[] {
  const manuals = events.filter((e) => e.source === 'manual');
  if (manuals.length === 0) return events;

  return events.filter((e) => {
    if (e.source === 'manual') return true;
    const overlapsManual = manuals.some(
      (m) =>
        new Date(m.startTime).getTime() < new Date(e.endTime).getTime() &&
        new Date(m.endTime).getTime() > new Date(e.startTime).getTime(),
    );
    return !overlapsManual;
  });
}

/** Same overlap rules used when building room display schedules. */
export function eventsForRoomDisplay(
  events: SignageEvent[],
  roomId: string,
): SignageEvent[] {
  const roomEvents = events
    .filter((e) => e.roomId === roomId && e.display !== false)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  return preferManualOverlaps(roomEvents);
}

/**
 * Pick current / next event. If the embedded schedule is for a day other
 * than hotel-today (e.g. sample Sept 10 import), evaluate using today's
 * clock time mapped onto that schedule date.
 */
export function pickCurrentAndNext(
  events: DisplayEventSnapshot[],
  now = new Date(),
  scheduleDateKey?: string,
) {
  const today = dateKeyInHotelTz(now);
  const ref =
    scheduleDateKey && scheduleDateKey !== today
      ? hotelNowOnDate(scheduleDateKey, now)
      : now;
  const t = ref.getTime();

  const current =
    events.find(
      (e) =>
        new Date(e.startTime).getTime() <= t &&
        new Date(e.endTime).getTime() > t,
    ) ?? null;
  const next =
    events.find((e) => new Date(e.startTime).getTime() > t) ?? null;

  // Left panel should still show an org when the day has bookings
  const primary = current ?? next ?? (events[0] ?? null);
  const primaryMode: 'now' | 'next' | 'today' | null = current
    ? 'now'
    : next
      ? 'next'
      : events[0]
        ? 'today'
        : null;

  return { current, next, primary, primaryMode, referenceTime: ref };
}

export async function ensureTodayDisplays(db: Firestore): Promise<boolean> {
  const today = dateKeyInHotelTz();
  const metaRef = doc(db, 'settings', 'schedule');

  const [metaSnap, roomsSnap] = await Promise.all([
    getDoc(metaRef),
    getDocs(collection(db, 'rooms')),
  ]);

  const metaOk = metaSnap.data()?.activeDateKey === today;
  const roomsOk =
    roomsSnap.size > 0 &&
    roomsSnap.docs.every((d) => d.data().scheduleDateKey === today);

  if (metaOk && roomsOk) return false;

  await rebuildRoomDisplaysForDate(db, today);
  await setDoc(
    metaRef,
    {
      activeDateKey: today,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  return true;
}

