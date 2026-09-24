const STAGED_KEY = 'signage_staged_count';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

export function readStagedCount(): number {
  try {
    const n = Number(localStorage.getItem(STAGED_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function writeStagedCount(count: number): void {
  const next = Math.max(0, Math.floor(count));
  try {
    localStorage.setItem(STAGED_KEY, String(next));
  } catch {
    /* ignore */
  }
  notify();
}

export function bumpStagedCount(by = 1): void {
  writeStagedCount(readStagedCount() + by);
}

export function clearStagedCount(): void {
  writeStagedCount(0);
}

export function subscribeStagedCount(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
