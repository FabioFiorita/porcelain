import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { ExpireGitActionReceiptsService } from './expire-git-action-receipts-service.ts';

const now = Date.parse('2026-09-23T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;

describe('ExpireGitActionReceiptsService', () => {
  it('forgets receipts that finished more than thirty days ago and keeps the rest', () => {
    const expired = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000001',
      state: 'succeeded',
      finishedAt: now - 30 * day - 1,
    });
    const atLimit = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000002',
      state: 'succeeded',
      finishedAt: now - 30 * day,
    });
    const running = sampleReceipt({
      requestId: '00000000-0000-4000-8000-000000000003',
      acceptedAt: now - 40 * day,
    });
    const store = new InMemoryGitActionStore([expired, atLimit, running]);
    new ExpireGitActionReceiptsService(
      store,
      new FixedClock(new Date(now).toISOString()),
    ).execute();
    expect(store.all().map((receipt) => receipt.requestId)).toEqual([
      atLimit.requestId,
      running.requestId,
    ]);
  });
});
