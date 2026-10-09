import { describe, expect, it } from 'vitest';
import {
  bulkMarkPlan,
  bulkMarkReport,
  bulkReportText,
  inChunks,
  layerReviewed,
  markAllPlan,
  reviewToggle,
  applyReviewedIntents,
} from './reviewed.ts';

const entry = (
  path: string,
  fingerprint: string | undefined,
  reviewStatus: 'unreviewed' | 'reviewed' | 'stale',
) => ({
  path,
  fingerprint,
  comparisons: [{ scope: 'untracked' as const, path }],
  environmentId: '00000000-0000-4000-8000-000000000000',
  worktreeId: 'w'.repeat(32),
  statusToken: 'token',
  reviewStatus,
});

describe('bulkMarkPlan', () => {
  it('marks each path once with the fingerprint the user saw, including files changed since their mark', () => {
    expect(
      bulkMarkPlan([
        entry('a.ts', 'seen-a', 'unreviewed'),
        entry('b.ts', 'seen-b', 'stale'),
        entry('a.ts', 'seen-a', 'unreviewed'),
      ]).files,
    ).toEqual([
      { path: 'a.ts', fingerprint: 'seen-a' },
      { path: 'b.ts', fingerprint: 'seen-b' },
    ]);
  });

  it('skips files already reviewed and files whose state could not be established', () => {
    expect(
      bulkMarkPlan([
        entry('done.ts', 'seen', 'reviewed'),
        entry('unknown.ts', undefined, 'unreviewed'),
      ]),
    ).toEqual({
      files: [],
      report: {
        marked: [],
        failed: [],
        skipped: [
          { path: 'done.ts', reason: 'already-reviewed' },
          { path: 'unknown.ts', reason: 'not-fingerprintable' },
        ],
      },
    });
  });
});

describe('bulkMarkReport', () => {
  it('reports the files the server marked and turns each refused file into a failure', () => {
    const report = bulkMarkReport(
      {
        marked: [],
        skipped: [{ path: 'done.ts', reason: 'already-reviewed' }],
        failed: [],
      },
      {
        worktreeId: 'w'.repeat(32),
        marks: [],
        marked: ['a.ts'],
        conflicts: [
          { path: 'gone.ts', reason: 'missing' },
          { path: 'moved.ts', reason: 'stale' },
        ],
      },
    );
    expect(report).toEqual({
      marked: ['a.ts'],
      skipped: [{ path: 'done.ts', reason: 'already-reviewed' }],
      failed: [
        {
          path: 'gone.ts',
          error: new Error('That file is no longer in the change list.'),
        },
        {
          path: 'moved.ts',
          error: new Error('The file changed since it was shown.'),
        },
      ],
    });
  });
});

describe('bulkReportText', () => {
  it('counts marked, skipped and failed files', () => {
    expect(
      bulkReportText({
        marked: ['a.ts'],
        skipped: [{ path: 'b.ts', reason: 'already-reviewed' }],
        failed: [{ path: 'c.ts', error: new Error('no') }],
      }),
    ).toBe('Marked 1 file. Skipped 1. 1 failed.');
  });

  it('says nothing was marked when every file was skipped', () => {
    expect(
      bulkReportText({
        marked: [],
        skipped: [{ path: 'b.ts', reason: 'already-reviewed' }],
        failed: [],
      }),
    ).toBe('No files marked. Skipped 1.');
  });
});

describe('markAllPlan', () => {
  it('offers to mark every unreviewed or changed file', () => {
    expect(
      markAllPlan([
        entry('a.ts', 'seen-a', 'unreviewed'),
        entry('b.ts', 'seen-b', 'stale'),
        entry('c.ts', 'seen-c', 'reviewed'),
      ]),
    ).toMatchObject({
      unmarking: false,
      blocked: false,
      label: 'Mark all 2 files reviewed',
      text: 'Mark all reviewed',
    });
  });

  it('offers to unmark exactly the reviewed files once nothing is left to mark', () => {
    expect(
      markAllPlan([
        entry('a.ts', 'seen-a', 'reviewed'),
        entry('b.ts', undefined, 'unreviewed'),
      ]),
    ).toMatchObject({
      reviewedPaths: ['a.ts'],
      unmarking: true,
      blocked: false,
      label: 'Unmark all',
      text: 'Unmark all',
    });
  });

  it('refuses when no file can be marked', () => {
    expect(markAllPlan([entry('a.ts', undefined, 'unreviewed')])).toEqual({
      entries: [entry('a.ts', undefined, 'unreviewed')],
      reviewedPaths: [],
      unmarking: false,
      blocked: true,
      label: 'No files can be marked reviewed',
      text: 'No reviewable files',
    });
  });
});

describe('layerReviewed', () => {
  const layer = {
    id: '11111111-1111-4111-8111-111111111111',
    fingerprint: 'layer-now',
  };
  const mark = (fingerprint: string, stale: boolean) => ({
    worktreeId: 'w'.repeat(32),
    marks: [
      {
        layerId: layer.id,
        fingerprint,
        reviewedAt: '2026-09-28T00:00:00.000Z',
        stale,
      },
    ],
  });

  it('shows a layer reviewed when its mark matches the layer shown', () => {
    expect(layerReviewed(mark('layer-now', false), layer)).toBe(true);
  });

  it('stops counting a layer whose mark the server found stale', () => {
    expect(layerReviewed(mark('layer-now', true), layer)).toBe(false);
  });

  it('stops counting a layer whose mark was made for other code', () => {
    expect(layerReviewed(mark('layer-before', false), layer)).toBe(false);
  });

  it('counts no layer reviewed before it has a mark', () => {
    expect(layerReviewed(undefined, layer)).toBe(false);
  });
});

it('reapplies a pending mark over a confirmed reply while preserving unrelated server marks', () => {
  const confirmed = {
    worktreeId: 'worktree',
    marks: [
      {
        path: 'server.md',
        fingerprint: 'confirmed',
        reviewedAt: 'server-time',
      },
    ],
  };
  const result = applyReviewedIntents(confirmed, [
    {
      id: Symbol(),
      changes: [{ path: 'pending.md', fingerprint: 'pending' }],
      reviewedAt: 'pending-time',
    },
  ]);
  expect(result.marks).toEqual([
    { path: 'server.md', fingerprint: 'confirmed', reviewedAt: 'server-time' },
    { path: 'pending.md', fingerprint: 'pending', reviewedAt: 'pending-time' },
  ]);
  expect(confirmed.marks.map((mark) => mark.path)).toEqual(['server.md']);
});
it('applies pending path edits in admission order, including an unmark followed by another mark', () => {
  expect(
    applyReviewedIntents(
      {
        worktreeId: 'worktree',
        marks: [
          { path: 'file.md', fingerprint: 'old', reviewedAt: 'old-time' },
        ],
      },
      [
        {
          id: Symbol(),
          changes: [{ path: 'file.md' }],
          reviewedAt: 'unmark-time',
        },
        {
          id: Symbol(),
          changes: [{ path: 'file.md', fingerprint: 'new' }],
          reviewedAt: 'new-time',
        },
      ],
    ).marks,
  ).toEqual([{ path: 'file.md', fingerprint: 'new', reviewedAt: 'new-time' }]);
});

describe('reviewToggle', () => {
  it('marks an unreviewed file with the fingerprint the user saw', () => {
    expect(
      reviewToggle(
        { path: 'a.ts', fingerprint: 'seen', reviewed: false },
        false,
      ),
    ).toEqual({ kind: 'mark', input: { path: 'a.ts', fingerprint: 'seen' } });
  });

  it('unmarks a reviewed file', () => {
    expect(
      reviewToggle(
        { path: 'a.ts', fingerprint: 'seen', reviewed: true },
        false,
      ),
    ).toEqual({ kind: 'unmark', path: 'a.ts' });
  });

  it('does nothing while a mark is pending or when the file state is unknown', () => {
    expect([
      reviewToggle({ path: 'a.ts', fingerprint: 'seen' }, true),
      reviewToggle({ path: 'a.ts', fingerprint: null }, false),
      reviewToggle(undefined, false),
    ]).toEqual([null, null, null]);
  });
});

describe('inChunks', () => {
  it('asks for more marks than one request holds in consecutive requests', () => {
    const files = Array.from({ length: 4001 }, (_, index) => index);
    expect(inChunks(files, 2000).map((chunk) => chunk.length)).toEqual([
      2000, 2000, 1,
    ]);
  });

  it('keeps the order of the files across requests', () => {
    expect(inChunks(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('asks for nothing when there is nothing to mark', () => {
    expect(inChunks([], 2000)).toEqual([]);
  });
});
