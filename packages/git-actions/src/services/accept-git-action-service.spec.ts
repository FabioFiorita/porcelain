import { describe, expect, it } from 'vitest';
import {
  GitActionReceiptMismatchError,
  MissingExpectedFilesError,
} from '@porcelain/git-actions/errors';
import type { AcceptGitActionInput } from '@porcelain/git-actions/models';
import { FixedClock } from '@porcelain/kernel/fakes';
import {
  cleanExpectation,
  projectId,
  worktreeId,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionStore } from '../../spec/fakes/in-memory-git-action-store.ts';
import { AcceptGitActionService } from './accept-git-action-service.ts';

const acceptedAt = '2026-09-23T12:00:00.000Z';
const request: AcceptGitActionInput = {
  projectId,
  worktreeId,
  requestId: '68044b95-e9a8-44d1-bdbf-e7b806c901a6',
  intent: { action: 'create-branch', branch: 'feature', switchTo: false },
  expected: cleanExpectation,
};

function subject(store = new InMemoryGitActionStore()) {
  return {
    store,
    service: new AcceptGitActionService(store, new FixedClock(acceptedAt)),
  };
}

describe('AcceptGitActionService', () => {
  it('keeps a running receipt for a new request and hands back the run', () => {
    const { store, service } = subject();
    const accepted = service.execute(request);
    expect(accepted.receipt).toEqual({
      requestId: request.requestId,
      projectId,
      worktreeId,
      action: 'create-branch',
      state: 'running',
      progress: [],
      acceptedAt: Date.parse(acceptedAt),
    });
    expect(accepted.run).toEqual({
      requestId: request.requestId,
      projectId,
      worktreeId,
      intent: request.intent,
      expected: request.expected,
    });
    expect(store.read(request.requestId)?.state).toBe('running');
  });

  it('answers a repeated request with its receipt and runs nothing again', () => {
    const { store, service } = subject();
    service.execute(request);
    const settled = store.read(request.requestId);
    if (!settled) throw new Error('receipt missing');
    store.save({ ...settled, state: 'succeeded', finishedAt: 1 });
    const replay = service.execute(structuredClone(request));
    expect(replay.run).toBeUndefined();
    expect(replay.receipt.state).toBe('succeeded');
    expect(store.all()).toHaveLength(1);
  });

  it('refuses a request ID reused for a different action', () => {
    const { service } = subject();
    service.execute(request);
    expect(() =>
      service.execute({
        ...request,
        intent: { action: 'create-branch', branch: 'other', switchTo: false },
      }),
    ).toThrow(GitActionReceiptMismatchError);
  });

  it('refuses a request ID reused for another worktree', () => {
    const { service } = subject();
    service.execute(request);
    expect(() =>
      service.execute({ ...request, worktreeId: 'f'.repeat(32) }),
    ).toThrow(GitActionReceiptMismatchError);
  });

  it('refuses a request that breaks a rule before keeping anything', () => {
    const { store, service } = subject();
    expect(() =>
      service.execute({
        ...request,
        intent: { action: 'commit', message: 'Fix', paths: ['README.md'] },
      }),
    ).toThrow(MissingExpectedFilesError);
    expect(store.all()).toEqual([]);
  });
});
