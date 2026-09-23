#!/usr/bin/env node
/**
 * Create (or overwrite) a staff account in the Firestore `users` collection.
 *
 * Password comes from CLI or ADMIN_PASSWORD in .env.local (never commit secrets).
 *
 * Usage:
 *   npm run create-admin -- admin 'your-password'
 *   npm run create-admin -- manager 'your-password' manager
 *   npm run create-admin -- frontDesk 'your-password' user
 *   # or set ADMIN_PASSWORD in .env.local, then:
 *   npm run create-admin
 *   npm run create-admin -- otheruser
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
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
    // optional
  }
}

loadEnvFile(resolve(root, '.env.local'));
loadEnvFile(resolve(root, '.env'));

function userIdFromUsername(username) {
  return username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

const username = process.argv[2] ?? 'admin';
const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
const roleArg = (process.argv[4] ?? 'admin').toLowerCase();
const role =
  roleArg === 'manager' ? 'manager' : roleArg === 'user' ? 'user' : 'admin';

if (!password) {
  console.error(
    "Missing password. Pass it as an argument or set ADMIN_PASSWORD in .env.local:\n\n  npm run create-admin -- admin 'your-password'\n  npm run create-admin -- manager 'your-password' manager\n  npm run create-admin -- frontDesk 'your-password' user\n",
  );
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.error('Missing Firebase config. Ensure .env.local is set.');
  process.exit(1);
}

const id = userIdFromUsername(username);
const passwordHash = hashPassword(password);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userDoc = {
  username: username.trim().toLowerCase(),
  email: username.trim().toLowerCase(),
  passwordHash,
  name:
    role === 'manager' ? 'Manager' : role === 'user' ? 'User' : 'Admin',
  role,
  active: true,
  createdAt: new Date().toISOString(),
};

try {
  await setDoc(doc(db, 'users', id), userDoc, { merge: true });
} catch (err) {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
  console.error('Failed to write users/' + id + ':', err?.message ?? err);
  if (code === 'permission-denied') {
    console.error(`
Firestore blocked the write. Deploy rules first (requires firebase login):

  npx firebase login
  npm run deploy:rules
  npm run create-admin
`);
  }
  process.exit(1);
}

console.log(`Created/updated users/${id}`);
console.log(`  username: ${userDoc.username}`);
console.log(`  role:  ${userDoc.role}`);
console.log(`  active: ${userDoc.active}`);
process.exit(0);
