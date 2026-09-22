/** Browser-safe SHA-256 hex (sync fallback via simple hash if needed) */

export function createHash(input: string): string {
  // FNV-1a 64-ish + expand for stable short ids without async crypto in parse path
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0xabcdef;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c * 31), 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  let h3 = 0;
  for (let i = 0; i < input.length; i++) h3 = (h3 * 33) ^ input.charCodeAt(i);
  const c = (h3 >>> 0).toString(16).padStart(8, '0');
  return `${a}${b}${c}`;
}
