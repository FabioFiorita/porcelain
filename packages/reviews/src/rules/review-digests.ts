import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MILLISECONDS_PER_SECOND = 1000;
export const SUMMARY_LIFETIME_SECONDS = 60 * 60;

export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function summaryMessage(token: string, expires: number): string {
  return `${token}\0${expires}`;
}

export function summarySignature(
  secret: string,
  token: string,
  expires: number,
): string {
  return createHmac('sha256', secret)
    .update(summaryMessage(token, expires))
    .digest('base64url');
}

export function summarySignatureMatches(
  secret: string,
  token: string,
  expires: number,
  signature: string,
): boolean {
  const expected = Buffer.from(summarySignature(secret, token, expires));
  const supplied = Buffer.from(signature);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function secondsAt(instant: string): number {
  return Math.floor(Date.parse(instant) / MILLISECONDS_PER_SECOND);
}

export function summaryExpiry(now: string): number {
  return secondsAt(now) + SUMMARY_LIFETIME_SECONDS;
}

export function summaryExpired(expires: number, now: string): boolean {
  return !Number.isSafeInteger(expires) || expires < secondsAt(now);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
