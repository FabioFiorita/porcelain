import { FixedClock } from '@porcelain/kernel/fakes';
import { describe, expect, it } from 'vitest';
import { sampleReceipt } from '../../spec/fixtures/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { RecoverInterruptedGitActionsService } from './recover-interrupted-git-actions-service.ts';

const restartedAt = '2026-09-23T14:00:00.000Z';

describe('RecoverInterruptedGitActionsService', () => {
  it('marks every action of the worktree still running at startup as interrupted with an unknown outcome', () => {
    const running = sampleReceipt();
    const settled = sampleReceipt({
      requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
      state: 'succeeded',
      finishedAt: '2026-09-23T13:00:00.000Z',
    });
    const store = new InMemoryGitActionReceiptStore([running, settled]);
    new RecoverInterruptedGitActionsService(
      store,
      new FixedClock(restartedAt),
    ).execute({ worktreeId: running.worktreeId });
    expect(store.read({ requestId: running.requestId })).toMatchObject({
      state: 'interrupted',
      reason: 'OUTCOME_UNKNOWN',
      refreshRequired: true,
      finishedAt: restartedAt,
    });
    expect(store.read({ requestId: settled.requestId })).toEqual(settled);
  });

  it('leaves the running actions of other worktrees to their own recovery', () => {
    const elsewhere = sampleReceipt({ worktreeId: 'other-worktree' });
    const store = new InMemoryGitActionReceiptStore([elsewhere]);
    new RecoverInterruptedGitActionsService(
      store,
      new FixedClock(restartedAt),
    ).execute({ worktreeId: 'worktree-without-actions' });
    expect(store.read({ requestId: elsewhere.requestId })).toEqual(elsewhere);
  });
});
