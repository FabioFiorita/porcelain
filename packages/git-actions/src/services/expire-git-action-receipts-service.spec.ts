import { FixedClock } from '@porcelain/kernel/fakes';
import { describe, expect, it } from 'vitest';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { ExpireGitActionReceiptsService } from './expire-git-action-receipts-service.ts';

const day = 24 * 60 * 60 * 1000;

describe('ExpireGitActionReceiptsService', () => {
  it('forgets receipts that finished longer ago than the retention and keeps the rest', () => {
    const expired = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000001',
      state: 'succeeded',
      finishedAt: '2026-08-24T11:59:59.999Z',
    });
    const atLimit = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000002',
      state: 'succeeded',
      finishedAt: '2026-08-24T12:00:00.000Z',
    });
    const running = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000003',
      acceptedAt: '2026-08-01T12:00:00.000Z',
    });
    const store = new InMemoryGitActionReceiptStore([
      expired,
      atLimit,
      running,
    ]);
    new ExpireGitActionReceiptsService(
      store,
      new FixedClock('2026-09-23T12:00:00.000Z'),
      { retentionMs: 30 * day },
    ).execute();
    expect(store.all().map((receipt) => receipt.requestId)).toEqual([
      atLimit.requestId,
      running.requestId,
    ]);
  });
});
