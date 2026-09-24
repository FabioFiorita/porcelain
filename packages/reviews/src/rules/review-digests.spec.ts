import { describe, expect, it } from 'vitest';
import { summaryExpired, summaryMessage } from './review-digests.ts';

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
