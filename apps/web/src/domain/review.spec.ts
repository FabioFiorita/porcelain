import { describe, expect, it } from 'vitest';
import {
  orderReviewChanges,
  reviewMark,
  reviewProgress,
  reviewStatus,
} from './review';

describe('reviewed change state', () => {
  const fingerprint = 'a'.repeat(64);
  const entry = { path: 'src/app.tsx', fingerprint };

  it('distinguishes unreviewed, reviewed, and stale fingerprints', () => {
    expect(reviewStatus(entry, [])).toBe('unreviewed');
    expect(
      reviewStatus(entry, [
        {
          path: entry.path,
          fingerprint,
          reviewedAt: '2026-09-13T00:00:00.000Z',
        },
      ]),
    ).toBe('reviewed');
    expect(
      reviewStatus({ ...entry, fingerprint: 'b'.repeat(64) }, [
        {
          path: entry.path,
          fingerprint,
          reviewedAt: '2026-09-13T00:00:00.000Z',
        },
      ]),
    ).toBe('stale');
  });

  it('keeps an unmarkable change visible without treating it as reviewed', () => {
    const mark = {
      path: entry.path,
      fingerprint,
      reviewedAt: '2026-09-13T00:00:00.000Z',
    };
    expect(reviewStatus({ path: entry.path, fingerprint: null }, [mark])).toBe(
      'unreviewed',
    );
    expect(reviewMark(entry, [mark])).toEqual(mark);
  });
});

describe('review progress', () => {
  it('counts each logical path once across duplicate scopes', () => {
    expect(
      reviewProgress(
        ['README.md', 'README.md', 'src/app.tsx'],
        [
          { path: 'README.md', reviewStatus: 'reviewed' },
          { path: 'src/app.tsx', reviewStatus: 'unreviewed' },
        ],
      ),
    ).toEqual({ done: 1, total: 2 });
  });

  it('keeps a stale or unestablished change out of the reviewed count', () => {
    expect(
      reviewProgress(
        ['README.md', 'missing.ts'],
        [{ path: 'README.md', reviewStatus: 'stale' }],
      ),
    ).toEqual({ done: 0, total: 2 });
  });

  it('reports an empty layer as empty rather than complete', () => {
    expect(reviewProgress([], [])).toEqual({ done: 0, total: 0 });
  });
});

it('orders whole-file changes by the agent story without dropping comparisons or unassigned files', () => {
  const changes = [
    { path: 'a.ts', comparisons: ['staged', 'unstaged'] },
    { path: 'b.ts', comparisons: ['unstaged'] },
    { path: 'z.ts', comparisons: ['staged'] },
  ];
  const ordered = orderReviewChanges(changes, [
    { path: 'z.ts' },
    { path: 'missing.ts' },
    { path: 'a.ts' },
    { path: 'a.ts' },
  ]);
  expect(ordered.map((entry) => entry.path)).toEqual(['z.ts', 'a.ts', 'b.ts']);
  expect(ordered[1]).toBe(changes[0]);
  expect(ordered[1]?.comparisons).toEqual(['staged', 'unstaged']);
});
