import { describe, expect, it } from 'vitest';
import { GitActionNotFoundError } from '@porcelain/git-actions/errors';
import { FixedClock } from '@porcelain/kernel/fakes';
import { sampleReceipt } from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { FinishGitActionService } from './finish-git-action-service.ts';

const finishedAt = '2026-09-23T12:00:05.000Z';
const running = sampleReceipt();

function subject() {
  const store = new InMemoryGitActionStore([running]);
  return {
    store,
    service: new FinishGitActionService(store, new FixedClock(finishedAt)),
  };
}

describe('FinishGitActionService', () => {
  it('settles the receipt with the outcome and the time it finished', () => {
    const { store, service } = subject();
    const view = service.execute({
      requestId: running.requestId,
      outcome: {
        state: 'succeeded',
        result: { branch: 'feature' },
        refreshRequired: true,
      },
    });
    expect(view).toEqual({
      requestId: running.requestId,
      projectId: running.projectId,
      worktreeId: running.worktreeId,
      action: 'create-branch',
      state: 'succeeded',
      progress: [],
      result: { branch: 'feature' },
      acceptedAt: running.acceptedAt,
      finishedAt: Date.parse(finishedAt),
    });
    expect(store.read(running.requestId)).toMatchObject({
      state: 'succeeded',
      refreshRequired: true,
      finishedAt: Date.parse(finishedAt),
    });
  });

  it('records an outcome Git could not determine as interrupted', () => {
    const { service } = subject();
    const view = service.execute({
      requestId: running.requestId,
      outcome: {
        state: 'indeterminate',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
      },
    });
    expect(view.state).toBe('interrupted');
    expect(view.reason).toBe('OUTCOME_UNKNOWN');
  });

  it('refuses a request it never accepted', () => {
    const { service } = subject();
    expect(() =>
      service.execute({
        requestId: 'e0c7a0f4-3b1c-4b58-9a57-4b3cf6f6b0d1',
        outcome: { state: 'succeeded', refreshRequired: false },
      }),
    ).toThrow(GitActionNotFoundError);
  });
});
