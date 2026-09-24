import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sameSignature(expected: string, supplied: string): boolean {
  return timingSafeEqual(digest(expected), digest(supplied));
}

export function summaryMessage(token: string, expires: string): string {
  return `${token}\0${expires}`;
}

export function summaryExpiry(now: string, lifetimeMs: number): string {
  return new Date(Date.parse(now) + lifetimeMs).toISOString();
}

export function summaryExpired(expires: string, now: string): boolean {
  return !(Date.parse(expires) >= Date.parse(now));
}

export function summaryUrl(
  token: string,
  expires: string,
  signature: string,
): string {
  return `/review-summaries/${encodeURIComponent(token)}?expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}
