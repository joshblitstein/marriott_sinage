/**
 * Seed rooms + combination aliases + app settings into Firestore.
 * Usage: npm run seed-rooms
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { DEFAULT_NON_DISPLAY_TYPES } from '../src/lib/city/parse';
import { buildRoomSeeds } from '../src/lib/roomsSeed';

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const rooms = buildRoomSeeds();

async function main() {
  for (const room of rooms) {
    await setDoc(doc(db, 'rooms', room.id), room, { merge: true });
    console.log(
      `rooms/${room.id} (${room.bookingAliases.length} aliases, active=${room.active})`,
    );
  }

  await setDoc(
    doc(db, 'settings', 'app'),
    {
      id: 'app',
      nonDisplayFunctionTypes: DEFAULT_NON_DISPLAY_TYPES,
      hotelTimeZone: 'America/New_York',
    },
    { merge: true },
  );

  console.log(`\nSeeded ${rooms.length} rooms + settings/app`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
