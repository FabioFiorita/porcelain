import {
  DiscardExpectationMismatchError,
  DuplicateExpectedFileError,
  EmptyCommitSelectionError,
  ExpectedFilesMismatchError,
  GitActionReceiptMismatchError,
  InvalidHunkRangeError,
  MergeExpectationMismatchError,
  MissingExpectedFilesError,
  MissingUpstreamExpectationError,
} from '@porcelain/git-actions/errors';
import type { AcceptGitActionInput } from '@porcelain/git-actions/models';
import { FixedClock } from '@porcelain/kernel/fakes';
import { describe, expect, it } from 'vitest';
import {
  CLEAN_EXPECTATION,
  PROJECT_ID,
  README_FINGERPRINT,
  REQUEST_ID,
  WORKTREE_ID,
} from '../../spec/fakes/git-action-samples.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';
import { AcceptGitActionService } from './accept-git-action-service.ts';

const acceptedAt = '2026-09-23T12:00:00.000Z';
const request: AcceptGitActionInput = {
  projectId: PROJECT_ID,
  worktreeId: WORKTREE_ID,
  requestId: REQUEST_ID,
  intent: { action: 'create-branch', branch: 'feature', switchTo: false },
  expected: CLEAN_EXPECTATION,
};
const readme = { path: 'README.md', fingerprint: README_FINGERPRINT };

function subject(store = new InMemoryGitActionReceiptStore()) {
  return {
    store,
    service: new AcceptGitActionService(store, new FixedClock(acceptedAt)),
  };
}

describe('AcceptGitActionService', () => {
  it('keeps a running receipt for a new request and hands back the run', () => {
    const { store, service } = subject();
    const accepted = service.execute(request);
    expect(accepted).toEqual({
      kind: 'accepted',
      receipt: {
        requestId: REQUEST_ID,
        projectId: PROJECT_ID,
        worktreeId: WORKTREE_ID,
        action: 'create-branch',
        state: 'running',
        progress: [],
        acceptedAt,
      },
      run: {
        requestId: REQUEST_ID,
        projectId: PROJECT_ID,
        worktreeId: WORKTREE_ID,
        intent: request.intent,
        expected: request.expected,
        target: { kind: 'unchecked' },
      },
    });
    expect(store.read({ requestId: REQUEST_ID })?.state).toBe('running');
  });

  it('hands back a run that checks the files a commit expects', () => {
    const { service } = subject();
    const accepted = service.execute({
      ...request,
      intent: { action: 'commit', message: 'Fix', paths: ['README.md'] },
      expected: { ...CLEAN_EXPECTATION, files: [readme] },
    });
    expect(accepted.kind === 'accepted' && accepted.run.target).toEqual({
      kind: 'checked',
      paths: ['README.md'],
    });
  });

  it('answers a repeated request with its receipt and runs nothing again', () => {
    const { store, service } = subject();
    service.execute(request);
    const settled = store.read({ requestId: REQUEST_ID });
    if (!settled) throw new Error('receipt missing');
    store.save({
      ...settled,
      state: 'succeeded',
      finishedAt: '2026-09-23T12:00:05.000Z',
    });
    const replay = service.execute(structuredClone(request));
    expect(replay.kind).toBe('repeated');
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

  it('names each malformed request by its error and keeps nothing', () => {
    const upstream = { remoteName: 'origin', sourceRef: 'refs/heads/main' };
    const cases: [Partial<AcceptGitActionInput>, new () => Error][] = [
      [
        { expected: { ...CLEAN_EXPECTATION, files: [readme, readme] } },
        DuplicateExpectedFileError,
      ],
      [
        { expected: { ...CLEAN_EXPECTATION, inProgress: 'merge' } },
        MergeExpectationMismatchError,
      ],
      [
        {
          intent: { action: 'commit', message: 'Fix', paths: [] },
          expected: { ...CLEAN_EXPECTATION, files: [] },
        },
        EmptyCommitSelectionError,
      ],
      [
        { intent: { action: 'commit', message: 'Fix', paths: ['README.md'] } },
        MissingExpectedFilesError,
      ],
      [
        {
          intent: { action: 'commit', message: 'Fix', paths: ['GUIDE.md'] },
          expected: { ...CLEAN_EXPECTATION, files: [readme] },
        },
        ExpectedFilesMismatchError,
      ],
      [
        { intent: { action: 'discard', path: 'README.md' } },
        DiscardExpectationMismatchError,
      ],
      [
        {
          intent: {
            action: 'stash-create',
            message: 'Park',
            includeUntracked: true,
          },
        },
        MissingExpectedFilesError,
      ],
      [
        { intent: { action: 'fetch', ...upstream } },
        MissingUpstreamExpectationError,
      ],
      [
        {
          intent: {
            action: 'discard',
            path: 'README.md',
            hunk: { scope: 'unstaged', startLine: 4, endLine: 3 },
          },
          expected: { ...CLEAN_EXPECTATION, files: [readme] },
        },
        InvalidHunkRangeError,
      ],
    ];
    for (const [change, error] of cases) {
      const { store, service } = subject();
      expect(() => service.execute({ ...request, ...change })).toThrow(error);
      expect(store.all()).toEqual([]);
    }
  });
});
