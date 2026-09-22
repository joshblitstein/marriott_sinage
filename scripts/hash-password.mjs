#!/usr/bin/env node
/**
 * Hash a password for a Firestore `users` document.
 * Usage: node scripts/hash-password.mjs "your-password"
 */
import { createHash } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "your-password"');
  process.exit(1);
}

const hash = createHash('sha256').update(password).digest('hex');
console.log(hash);
