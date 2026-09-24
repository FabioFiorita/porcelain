import { describe, expect, it } from 'vitest';
import {
  GitActionNotFoundError,
  GitActionReceiptMismatchError,
} from '@porcelain/git-actions/errors';
import { FixedClock } from '@porcelain/kernel/fakes';
import {
  projectId,
  sampleReceipt,
  worktreeId,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { DismissInterruptedGitActionService } from './dismiss-interrupted-git-action-service.ts';

const dismissedAt = '2026-09-23T13:00:00.000Z';
const interrupted = sampleReceipt({
  state: 'interrupted',
  reason: 'OUTCOME_UNKNOWN',
  finishedAt: 2,
});
const scope = { projectId, worktreeId, requestId: interrupted.requestId };

function subject(receipt = interrupted) {
  const store = new InMemoryGitActionStore([receipt]);
  return {
    store,
    service: new DismissInterruptedGitActionService(
      store,
      new FixedClock(dismissedAt),
    ),
  };
}

describe('DismissInterruptedGitActionService', () => {
  it('dismisses an interrupted action so the worktree no longer shows it', () => {
    const { store, service } = subject();
    service.execute(scope);
    expect(store.read(interrupted.requestId)?.dismissedAt).toBe(
      Date.parse(dismissedAt),
    );
    expect(store.latestUndismissed(worktreeId)).toBeUndefined();
  });

  it('does not find a request it never accepted', () => {
    const { service } = subject();
    expect(() =>
      service.execute({
        ...scope,
        requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
      }),
    ).toThrow(GitActionNotFoundError);
  });

  it('refuses a request that belongs to another worktree or project', () => {
    const { service } = subject();
    expect(() =>
      service.execute({ ...scope, worktreeId: 'f'.repeat(32) }),
    ).toThrow(GitActionReceiptMismatchError);
    expect(() =>
      service.execute({
        ...scope,
        projectId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toThrow(GitActionReceiptMismatchError);
  });

  it('refuses an action that did not end interrupted', () => {
    const { store, service } = subject(
      sampleReceipt({ state: 'succeeded', finishedAt: 2 }),
    );
    expect(() => service.execute(scope)).toThrow(GitActionReceiptMismatchError);
    expect(store.read(interrupted.requestId)?.dismissedAt).toBeUndefined();
  });
});
