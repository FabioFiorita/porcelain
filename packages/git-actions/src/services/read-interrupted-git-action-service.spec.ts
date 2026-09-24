import { describe, expect, it } from 'vitest';
import {
  WORKTREE_ID,
  sampleReceipt,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { ReadInterruptedGitActionService } from './read-interrupted-git-action-service.ts';

const interrupted = (requestId: string, finishedAt: string) =>
  sampleReceipt({
    requestId,
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    finishedAt,
  });

describe('ReadInterruptedGitActionService', () => {
  it('answers the most recently interrupted action of the worktree', () => {
    const service = new ReadInterruptedGitActionService(
      new InMemoryGitActionReceiptStore([
        interrupted(
          '00000000-0000-4000-8000-000000000001',
          '2026-09-23T09:00:00.000Z',
        ),
        interrupted(
          '00000000-0000-4000-8000-000000000002',
          '2026-09-23T11:00:00.000Z',
        ),
        interrupted(
          '00000000-0000-4000-8000-000000000003',
          '2026-09-23T10:00:00.000Z',
        ),
      ]),
    );
    const answer = service.execute({ worktreeId: WORKTREE_ID });
    expect(answer.kind === 'interrupted' && answer.receipt.requestId).toBe(
      '00000000-0000-4000-8000-000000000002',
    );
  });

  it('answers none when nothing interrupted is left to show', () => {
    const service = new ReadInterruptedGitActionService(
      new InMemoryGitActionReceiptStore([
        {
          ...interrupted(
            '00000000-0000-4000-8000-000000000001',
            '2026-09-23T09:00:00.000Z',
          ),
          dismissedAt: '2026-09-23T09:30:00.000Z',
        },
        {
          ...interrupted(
            '00000000-0000-4000-8000-000000000002',
            '2026-09-23T09:00:00.000Z',
          ),
          worktreeId: 'f'.repeat(32),
        },
        sampleReceipt({
          requestId: '00000000-0000-4000-8000-000000000003',
          state: 'succeeded',
          finishedAt: '2026-09-23T09:00:00.000Z',
        }),
      ]),
    );
    expect(service.execute({ worktreeId: WORKTREE_ID })).toEqual({
      kind: 'none',
    });
  });
});
