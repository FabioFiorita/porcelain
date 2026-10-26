import { ReviewPullRequestRefusedError } from '@porcelain/contracts/reviews';
import { describe, expect, it } from 'vitest';
import {
  mergeBranchChanges,
  mergeReviewChanges,
  reviewErrorMessage,
  reviewSummaryUrl,
  summaryLayerLinks,
  summaryLayerNumber,
} from './review.ts';

describe('reviewSummaryUrl', () => {
  const summary = {
    token: 'remote-review',
    expires: '2026-10-01T00:00:00.000Z',
    signature: 'signed-link',
    byteLength: 100,
  };

  it('loads a local summary from the desktop app, which serves this computer', () => {
    expect(
      reviewSummaryUrl(
        summary,
        'porcelain://app/project/worktree',
        'porcelain://app',
      ),
    ).toBe(
      'porcelain://app/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    );
  });

  it('loads a remote summary through the desktop app, naming the computer that published it', () => {
    expect(
      reviewSummaryUrl(summary, 'http://192.168.1.10:4738', 'porcelain://app'),
    ).toBe(
      'porcelain://app/remote-review-summaries/remote-review?computer=http%3A%2F%2F192.168.1.10%3A4738&expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    );
  });

  it('loads a summary from its own computer, with its signed query, when the web runs outside the desktop app', () => {
    expect([
      reviewSummaryUrl(summary, 'http://192.168.1.10:4738', undefined),
      reviewSummaryUrl(summary, 'https://computer.example.invalid', undefined),
    ]).toEqual([
      'http://192.168.1.10:4738/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
      'https://computer.example.invalid/review-summaries/remote-review?expires=2026-10-01T00%3A00%3A00.000Z&signature=signed-link',
    ]);
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

describe('summaryLayerLinks', () => {
  it('lists each decision the page links to once, in reading order', () => {
    expect(
      summaryLayerLinks(
        `<p><a href="#layer-3">journal</a> <A HREF='#layer-1'>owner</A> <a href = "#layer-3">again</a> <a href="#layer-12">twelve</a></p>`,
      ),
    ).toEqual([3, 1, 12]);
  });

  it('ignores links that do not open a decision', () => {
    expect(
      summaryLayerLinks(
        `<a href="https://example.com/#layer-2">site</a><a href="#layer-">blank</a><a href="#layer-0">zero</a><a href="#layers-4">other</a><p>#layer-5 as text</p><a data-href="#layer-6">data</a>`,
      ),
    ).toEqual([]);
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

it('shows why linking a pull request was refused', () => {
  const error = new Error('The pull request head must be feature.');
  error.name = 'ReviewPullRequestRefusedError';
  expect(reviewErrorMessage(error)).toBe(
    'The pull request head must be feature.',
  );
});

it('keeps the declared refusal reason when production minifies its error class name', () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    ReviewPullRequestRefusedError,
    'name',
  );
  if (!descriptor)
    throw new Error('The refusal error must have a runtime class name');
  try {
    Object.defineProperty(ReviewPullRequestRefusedError, 'name', {
      value: 'a',
      configurable: true,
    });
    const decoded = new Error('The pull request repository must match origin.');
    decoded.name = 'a';
    expect(reviewErrorMessage(decoded)).toBe(
      'The pull request repository must match origin.',
    );
    expect(
      reviewErrorMessage(
        new ReviewPullRequestRefusedError({
          message: 'The pull request head must be feature.',
        }),
      ),
    ).toBe('The pull request head must be feature.');
  } finally {
    Object.defineProperty(ReviewPullRequestRefusedError, 'name', descriptor);
  }
});
