import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { RecoverInterruptedGitActionsService } from './recover-interrupted-git-actions-service.ts';

const restartedAt = '2026-09-23T14:00:00.000Z';

describe('RecoverInterruptedGitActionsService', () => {
  it('marks every action still running at startup as interrupted with an unknown outcome', () => {
    const running = sampleReceipt();
    const settled = sampleReceipt({
      requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
      state: 'succeeded',
      finishedAt: 5,
    });
    const store = new InMemoryGitActionStore([running, settled]);
    new RecoverInterruptedGitActionsService(
      store,
      store,
      new FixedClock(restartedAt),
    ).execute({});
    expect(store.read(running.requestId)).toMatchObject({
      state: 'interrupted',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
      finishedAt: Date.parse(restartedAt),
    });
    expect(store.read(settled.requestId)).toEqual(settled);
  });
});
