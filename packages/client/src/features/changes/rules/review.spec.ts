import { describe, expect, it } from 'vitest';
import {
  mergeBranchChanges,
  mergeReviewChanges,
  reviewErrorMessage,
} from './review.ts';
const list = {
  environmentId: '00000000-0000-4000-8000-000000000000',
  worktreeId: 'w'.repeat(32),
  statusToken: 'token',
  headOid: undefined,
  inProgress: undefined,
  mergeHeadOid: undefined,
  branch: undefined,
  changes: [
    {
      path: 'same.ts',
      fingerprint: 'now-same',
      comparisons: [{ scope: 'untracked' as const, path: 'same.ts' }],
    },
    {
      path: 'edited.ts',
      fingerprint: 'now-edited',
      comparisons: [{ scope: 'untracked' as const, path: 'edited.ts' }],
    },
    {
      path: 'unknown.ts',
      fingerprint: undefined,
      comparisons: [{ scope: 'untracked' as const, path: 'unknown.ts' }],
    },
  ],
};
const at = '2026-09-28T00:00:00.000Z';
const reviewed = {
  worktreeId: 'w'.repeat(32),
  marks: [
    { path: 'same.ts', fingerprint: 'now-same', reviewedAt: at },
    { path: 'edited.ts', fingerprint: 'before-edit', reviewedAt: at },
    { path: 'unknown.ts', fingerprint: 'before', reviewedAt: at },
  ],
};

describe('mergeReviewChanges', () => {
  it('keeps a file reviewed only while its mark matches its current state', () => {
    expect(
      mergeReviewChanges(list, reviewed).map((item) => [
        item.path,
        item.reviewStatus,
      ]),
    ).toEqual([
      ['same.ts', 'reviewed'],
      ['edited.ts', 'stale'],
      ['unknown.ts', 'unreviewed'],
    ]);
  });

  it('returns only the requested paths with their change list context', () => {
    expect(mergeReviewChanges(list, reviewed, ['edited.ts'])).toEqual([
      {
        path: 'edited.ts',
        fingerprint: 'now-edited',
        comparisons: [{ scope: 'untracked', path: 'edited.ts' }],
        environmentId: '00000000-0000-4000-8000-000000000000',
        worktreeId: 'w'.repeat(32),
        statusToken: 'token',
        reviewStatus: 'stale',
        mark: { path: 'edited.ts', fingerprint: 'before-edit', reviewedAt: at },
      },
    ]);
  });
});

describe('reviewErrorMessage', () => {
  it('hides other failures behind a retry message', () => {
    expect(reviewErrorMessage(new Error('socket hang up'))).toBe(
      'These changes could not be loaded. Try again.',
    );
  });
});

describe('mergeBranchChanges', () => {
  const file = (path: string, fingerprint: string) => ({
    path,
    oldPath: path,
    newPath: path,
    status: 'modified' as const,
    oldMode: '100644',
    newMode: '100644',
    fingerprint,
  });
  const marks = {
    worktreeId: 'w'.repeat(32),
    marks: [
      {
        path: 'same.ts',
        fingerprint: 'f1',
        reviewedAt: '2026-09-01T00:00:00Z',
      },
      {
        path: 'moved.ts',
        fingerprint: 'old',
        reviewedAt: '2026-09-01T00:00:00Z',
      },
    ],
  };

  it('reads each branch file as reviewed, changed since reviewed or not reviewed', () => {
    expect(
      mergeBranchChanges(
        [
          file('same.ts', 'f1'),
          file('moved.ts', 'new'),
          file('fresh.ts', 'f3'),
        ],
        marks,
      ).map((item) => [item.path, item.reviewStatus]),
    ).toEqual([
      ['same.ts', 'reviewed'],
      ['moved.ts', 'stale'],
      ['fresh.ts', 'unreviewed'],
    ]);
  });
});
