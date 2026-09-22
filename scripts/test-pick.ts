import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { pickCurrentAndNext } from '../src/lib/schedule';

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
});
const db = getFirestore(app);

async function main() {
  for (const id of ['symphony-4', 'symphony-1', 'mecklenburg-1']) {
    const s = await getDoc(doc(db, 'rooms', id));
    const d = s.data()!;
    const r = pickCurrentAndNext(
      d.scheduleEvents ?? [],
      new Date(),
      d.scheduleDateKey,
    );
    console.log(id, {
      mode: r.primaryMode,
      org: r.primary?.orgDisplayName,
      title: r.primary?.title,
      ref: r.referenceTime.toISOString(),
    });
  }
}

main();
