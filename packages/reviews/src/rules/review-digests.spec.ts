import { describe, expect, it } from 'vitest';
import {
  SUMMARY_LIFETIME_SECONDS,
  summaryExpired,
  summaryExpiry,
  summarySignature,
  summarySignatureMatches,
} from './review-digests.ts';

const secret = 'a'.repeat(64);
const token = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b10';
const expires = 1_800_000_000;

describe('summary signature', () => {
  it('is a 43 character base64url string', () => {
    expect(summarySignature(secret, token, expires)).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
  });

  it('verifies the signature it produced for the same token and expiry', () => {
    const signature = summarySignature(secret, token, expires);
    expect(summarySignatureMatches(secret, token, expires, signature)).toBe(
      true,
    );
  });

  it('refuses a signature made for another token, expiry or secret', () => {
    const signature = summarySignature(secret, token, expires);
    const otherToken = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b11';
    expect(
      summarySignatureMatches(secret, otherToken, expires, signature),
    ).toBe(false);
    expect(summarySignatureMatches(secret, token, expires + 1, signature)).toBe(
      false,
    );
    expect(
      summarySignatureMatches('b'.repeat(64), token, expires, signature),
    ).toBe(false);
  });

  it('refuses a truncated or altered signature', () => {
    const signature = summarySignature(secret, token, expires);
    const altered = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
    expect(
      summarySignatureMatches(secret, token, expires, signature.slice(1)),
    ).toBe(false);
    expect(summarySignatureMatches(secret, token, expires, altered)).toBe(
      false,
    );
  });

  it('cannot be forged by moving digits between token and expiry', () => {
    expect(summarySignature(secret, 'token1', 23)).not.toBe(
      summarySignature(secret, 'token', 123),
    );
  });
});

describe('summary expiry', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const nowSeconds = Date.parse(now) / 1000;

  it('lets a link live for the summary lifetime from now', () => {
    expect(summaryExpiry(now)).toBe(nowSeconds + SUMMARY_LIFETIME_SECONDS);
  });

  it('treats a link as valid through its expiry second and expired after it', () => {
    expect(summaryExpired(nowSeconds, now)).toBe(false);
    expect(summaryExpired(nowSeconds - 1, now)).toBe(true);
  });

  it('treats an expiry that is not a safe integer as expired', () => {
    expect(summaryExpired(Number.MAX_SAFE_INTEGER + 2, now)).toBe(true);
    expect(summaryExpired(Number.NaN, now)).toBe(true);
  });
});
