import { describe, expect, it } from 'vitest';
import {
  mergeBranchChanges,
  mergeReviewChanges,
  reviewErrorMessage,
  reviewSummaryUrl,
  summaryLayerNumber,
} from './review.ts';

describe('reviewSummaryUrl', () => {
  const summary = {
    token: 'remote-review',
    expires: '2026-10-01T00:00:00.000Z',
    signature: 'signed-link',
    byteLength: 100,
  };

  it('loads a local summary through the desktop app origin', () => {
    expect(reviewSummaryUrl(summary, 'porcelain://app/project/worktree')).toBe(
      'porcelain://app/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    );
  });

  it('loads a remote summary from its HTTP computer with its signed query', () => {
    expect(reviewSummaryUrl(summary, 'http://192.168.1.10:4738')).toBe(
      'http://192.168.1.10:4738/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    );
  });

  it('loads a remote summary from its HTTPS computer', () => {
    expect(reviewSummaryUrl(summary, 'https://computer.example.invalid')).toBe(
      'https://computer.example.invalid/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    );
  });
});

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
  it('shows why the review context changed', () => {
    const error = new Error('The review context changed.');
    error.name = 'ConnectionError';
    expect(reviewErrorMessage(error)).toBe('The review context changed.');
  });

  it('hides other failures behind a retry message', () => {
    expect(reviewErrorMessage(new Error('socket hang up'))).toBe(
      'This review surface could not be loaded. Try again.',
    );
  });
});

describe('summaryLayerNumber', () => {
  it('reads the layer the summary asks to open', () => {
    expect(
      summaryLayerNumber({ source: 'porcelain-summary', openLayer: 2 }),
    ).toBe(2);
  });

  it('ignores messages that are not a layer request from the summary', () => {
    expect([
      summaryLayerNumber({ source: 'elsewhere', openLayer: 2 }),
      summaryLayerNumber({ source: 'porcelain-summary', openLayer: 1.5 }),
      summaryLayerNumber({ source: 'porcelain-summary', openLayer: '2' }),
      summaryLayerNumber({ source: 'porcelain-summary' }),
      summaryLayerNumber('porcelain-summary'),
      summaryLayerNumber(null),
    ]).toEqual([null, null, null, null, null, null]);
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

  it('keeps only the asked paths', () => {
    expect(
      mergeBranchChanges(
        [file('same.ts', 'f1'), file('fresh.ts', 'f3')],
        marks,
        ['fresh.ts'],
      ).map((item) => item.path),
    ).toEqual(['fresh.ts']);
  });
});
