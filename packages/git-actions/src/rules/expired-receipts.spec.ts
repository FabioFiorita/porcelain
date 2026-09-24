import { describe, expect, it } from 'vitest';
import { expiredReceipts } from './expired-receipts.ts';

const day = 24 * 60 * 60 * 1000;
const now = '2026-09-23T12:00:00.000Z';

describe('expiredReceipts', () => {
  it('names only the receipts that finished longer than the retention ago', () => {
    expect(
      expiredReceipts(
        [
          { requestId: 'at-retention', finishedAt: '2026-08-24T12:00:00.000Z' },
          { requestId: 'just-past', finishedAt: '2026-08-24T11:59:59.999Z' },
          { requestId: 'recent', finishedAt: '2026-09-23T11:59:00.000Z' },
          { requestId: 'long-ago', finishedAt: '2026-01-01T00:00:00.000Z' },
        ],
        now,
        30 * day,
      ),
    ).toEqual(['just-past', 'long-ago']);
  });

  it('names nothing when nothing has finished', () => {
    expect(expiredReceipts([], now, 30 * day)).toEqual([]);
  });

  it('compares instants, not their spelling', () => {
    expect(
      expiredReceipts(
        [{ requestId: 'offset', finishedAt: '2026-08-24T13:00:00.000+01:00' }],
        now,
        30 * day,
      ),
    ).toEqual([]);
  });
});
