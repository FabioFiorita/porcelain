import { describe, expect, it } from 'vitest';
import { receiptExpired } from './receipt-expired.ts';

const day = 24 * 60 * 60 * 1000;
const now = '2026-09-23T12:00:00.000Z';

describe('receiptExpired', () => {
  it('keeps a receipt that finished exactly the retention ago', () => {
    expect(receiptExpired('2026-08-24T12:00:00.000Z', now, 30 * day)).toBe(
      false,
    );
  });

  it('expires a receipt one millisecond older than the retention', () => {
    expect(receiptExpired('2026-08-24T11:59:59.999Z', now, 30 * day)).toBe(
      true,
    );
  });

  it('keeps a receipt that finished moments ago', () => {
    expect(receiptExpired('2026-09-23T11:59:00.000Z', now, 30 * day)).toBe(
      false,
    );
  });
});
