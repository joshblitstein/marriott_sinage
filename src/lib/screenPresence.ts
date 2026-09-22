import { doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';

/** Heartbeat while a display tab is open */
export const PRESENCE_HEARTBEAT_MS = 15_000;
/**
 * If screenOnline stayed true but heartbeat stopped (crash / killed tab),
 * treat as offline after this window.
 */
export const PRESENCE_OFFLINE_MS = 45_000;

export type ScreenPresenceFields = {
  screenOnline?: boolean;
  lastSeenAt?: string;
};

export function isScreenOnline(
  fields: ScreenPresenceFields | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!fields?.screenOnline || !fields.lastSeenAt) return false;
  const age = nowMs - new Date(fields.lastSeenAt).getTime();
  return age >= 0 && age < PRESENCE_OFFLINE_MS;
}

/** Firestore document path segments, e.g. ['rooms', 'symphony-1'] or ['settings', 'lobby'] */
export type PresenceDocPath = [string, string];

function presencePayload(online: boolean) {
  return {
    screenOnline: online,
    lastSeenAt: new Date().toISOString(),
  };
}

export async function setScreenPresence(
  path: PresenceDocPath,
  online: boolean,
  extra?: Record<string, unknown>,
): Promise<void> {
  await setDoc(
    doc(db, path[0], path[1]),
    { ...presencePayload(online), ...extra },
    { merge: true },
  );
}

/**
 * Best-effort offline write on tab close. Firestore SDK often cannot finish
 * during unload; keepalive fetch to the REST API usually can.
 */
export function beaconScreenOffline(
  path: PresenceDocPath,
  extra?: Record<string, unknown>,
): void {
  const projectId = firebaseConfig.projectId;
  const apiKey = firebaseConfig.apiKey;
  if (!projectId || !apiKey) return;

  const fields: Record<string, unknown> = {
    screenOnline: { booleanValue: false },
    lastSeenAt: { stringValue: new Date().toISOString() },
  };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      }
    }
  }

  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path[0]}/${path[1]}?${mask}&key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({ fields });

  try {
    void fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore — tab is closing */
  }
}
