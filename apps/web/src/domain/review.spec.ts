import { describe, expect, it } from 'vitest';
import { reviewFixture } from '../api/review/fixtures';
import {
  artifactKind,
  changePath,
  groupChanges,
  orderReviewEvidence,
  reviewMark,
  reviewProgress,
  reviewStatus,
} from './review';

it('uses layer/file order and keeps unassigned and stale metadata from hiding real changes', () => {
  const { status, layers } = reviewFixture(
    '801a86281cd6456281a29c05fba76b4a',
    '7fe18f78-1477-4c19-a42b-cdd42f862151',
    'refs/heads/main',
  );
  layers.layers[0]?.files.unshift({ path: 'missing.ts', scope: 'staged' });
  const groups = groupChanges(status, layers);
  expect(groups.map((group) => group.title)).toEqual([
    'A clearer review experience',
    'Refine the foundation',
    'Unassigned',
  ]);
  expect(groups[1]?.changes.map(changePath)).toEqual([
    'src/domain/review.ts',
    'src/styles/theme.css',
  ]);
  expect(groups.flatMap((group) => group.changes)).toHaveLength(
    status.changes.length,
  );
});

describe('artifact format selection', () => {
  it('uses extensions and recognizable content when artifact names are titles', () => {
    expect(artifactKind('notes.md', 'plain')).toBe('markdown');
    expect(artifactKind('Launch report', '<!doctype html><html />')).toBe(
      'html',
    );
    expect(artifactKind('Keyboard audit', '# Keyboard audit')).toBe('markdown');
    expect(artifactKind('Design study', 'Ordinary notes')).toBe('text');
  });
});

describe('reviewed evidence state', () => {
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

  it('keeps unreviewable evidence visible without treating it as reviewed', () => {
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

  it('keeps stale and missing evidence incomplete', () => {
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

it('orders whole-file evidence by the agent story without dropping comparisons or unassigned files', () => {
  const evidence = [
    { path: 'a.ts', comparisons: ['staged', 'unstaged'] },
    { path: 'b.ts', comparisons: ['unstaged'] },
    { path: 'z.ts', comparisons: ['staged'] },
  ];
  const ordered = orderReviewEvidence(evidence, [
    { path: 'z.ts' },
    { path: 'missing.ts' },
    { path: 'a.ts' },
    { path: 'a.ts' },
  ]);
  expect(ordered.map((entry) => entry.path)).toEqual(['z.ts', 'a.ts', 'b.ts']);
  expect(ordered[1]).toBe(evidence[0]);
  expect(ordered[1]?.comparisons).toEqual(['staged', 'unstaged']);
});
