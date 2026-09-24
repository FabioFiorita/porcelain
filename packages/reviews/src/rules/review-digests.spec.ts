import { describe, expect, it } from 'vitest';
import {
  summaryExpired,
  summaryMessage,
  summaryUrl,
} from './review-digests.ts';

const token = '6f1c2f4e-7c1b-4b61-9d6e-2f0a4f3a9b10';
const expires = '2026-01-01T01:00:00.000Z';

describe('summaryMessage', () => {
  it('cannot be forged by moving characters between token and expiry', () => {
    expect(summaryMessage('token1', '2026')).not.toBe(
      summaryMessage('token', '12026'),
    );
  });
});

describe('summaryExpired', () => {
  it('treats a link as valid through its expiry instant and expired after it', () => {
    expect(summaryExpired(expires, '2026-01-01T01:00:00.000Z')).toBe(false);
    expect(summaryExpired(expires, '2026-01-01T00:59:59.999Z')).toBe(false);
    expect(summaryExpired(expires, '2026-01-01T01:00:00.001Z')).toBe(true);
  });

  it('treats an expiry that is not an instant as expired', () => {
    expect(summaryExpired('tomorrow', '2026-01-01T00:00:00.000Z')).toBe(true);
    expect(summaryExpired('', '2026-01-01T00:00:00.000Z')).toBe(true);
  });
});

describe('summaryUrl', () => {
  it('links the summary page with the expiry and signature it was signed for', () => {
    const url = new URL(summaryUrl(token, expires, 'A'.repeat(43)), 'http://x');
    expect(url.pathname).toBe(`/review-summaries/${token}`);
    expect(url.searchParams.get('expires')).toBe(expires);
    expect(url.searchParams.get('signature')).toBe('A'.repeat(43));
  });
});
