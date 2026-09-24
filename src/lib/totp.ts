import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { hashPassword } from './password';

export const TOTP_ISSUER = 'Sheraton Charlotte Signage';

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secretBase32: string, username: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function totpUri(secretBase32: string, username: string): string {
  return buildTotp(secretBase32, username).toString();
}

export async function totpQrDataUrl(
  secretBase32: string,
  username: string,
): Promise<string> {
  return QRCode.toDataURL(totpUri(secretBase32, username), {
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
  });
}

/** Allow ±1 step drift (30s window each side). */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const delta = buildTotp(secretBase32, 'verify').validate({
    token: cleaned,
    window: 1,
  });
  return delta !== null;
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < count; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    let raw = '';
    for (const b of bytes) raw += alphabet[b % alphabet.length];
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => hashPassword(normalizeRecoveryCode(c))));
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export async function consumeRecoveryCode(
  code: string,
  hashes: string[],
): Promise<string[] | null> {
  const target = await hashPassword(normalizeRecoveryCode(code));
  const idx = hashes.findIndex((h) => h === target);
  if (idx === -1) return null;
  return hashes.filter((_, i) => i !== idx);
}
