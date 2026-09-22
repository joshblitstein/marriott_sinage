/** SHA-256 hex digest for password checks against the Firestore users collection */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Stable Firestore document id derived from username */
export function userIdFromUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}
