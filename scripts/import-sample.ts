/**
 * Import sample CITY xlsx into Firestore (for validation).
 * Usage: npm run import-sample
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { importCityRows } from '../src/lib/city/import';

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
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID!,
});

const db = getFirestore(app);
const file =
  process.argv[2] ??
  resolve(process.cwd(), 'sample-data/CI_Output_for_Readerboard_Data.xlsx');

async function main() {
  const buf = readFileSync(file);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<
    string,
    unknown
  >[];
  console.log(`Parsed ${rows.length} rows from ${file}`);
  const summary = await importCityRows(db, rows);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
