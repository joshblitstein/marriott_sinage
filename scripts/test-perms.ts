import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

function loadEnv(path: string) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv('.env.local');

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
});
const db = getFirestore(app);

async function main() {
  for (const col of [
    'organizations',
    'events',
    'displays',
    'imports',
    'rooms',
  ]) {
    try {
      await setDoc(
        doc(db, col, '_perm_test'),
        { ok: true, at: new Date().toISOString() },
        { merge: true },
      );
      console.log(`${col}: WRITE OK`);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.log(`${col}: FAIL ${err.code ?? err.message}`);
    }
  }
}

main();
