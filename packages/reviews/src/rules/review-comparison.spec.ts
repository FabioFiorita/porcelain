import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import type { Review, ReviewLayer } from '../models/review.ts';
import type { ReviewComparisonContext } from '../models/review-comparison.ts';
import { compareReviewRevisions } from './review-comparison.ts';

const empty: ReviewComparisonContext = {
  marks: { files: [], decisions: [] },
  threads: [],
};
function file(
  path: string,
  oldOid = 'base',
  newOid = 'head',
): Review['files'][number] {
  return {
    path,
    oldOid,
    newOid,
    status: 'modified',
    oldMode: '100644',
    newMode: '100644',
  };
}
function deleted(path: string): Review['files'][number] {
  const { newOid: _, ...rest } = file(path);
  return { ...rest, status: 'deleted', newMode: '000000' };
}
function layer(
  id: string,
  fingerprint: string,
  path = 'changed',
  kind: 'changed' | 'context' = 'changed',
): ReviewLayer {
  return {
    id,
    fingerprint,
    title: id,
    summary: id,
    lanes: ['Code'],
    steps: [
      {
        id: `${id}-step`,
        title: id,
        text: id,
        lane: 0,
        kind,
        pointer: { path, startLine: 1, endLine: 1 },
        published: ['code'],
      },
    ],
  };
}
const before = reviewFixture({
  files: [file('changed'), file('left'), file('same'), file('base-only')],
});
const after = reviewFixture({
  revision: 2,
  files: [
    file('changed', 'base', 'next'),
    file('entered'),
    file('same'),
    file('base-only', 'new-base'),
  ],
});

it('classifies review membership and both blob sides, including base-only changes', () => {
  expect(compareReviewRevisions(before, after, empty).files).toEqual([
    {
      path: 'base-only',
      change: 'changed',
      headChanged: false,
      baseChanged: true,
    },
    {
      path: 'changed',
      change: 'changed',
      headChanged: true,
      baseChanged: false,
    },
    {
      path: 'entered',
      change: 'entered',
    },
    { path: 'left', change: 'left' },
    {
      path: 'same',
      change: 'unchanged',
      headChanged: false,
      baseChanged: false,
    },
  ]);
});
it('a rebase onto newer main compares the manifests and never imports unrelated base files', () => {
  const a = reviewFixture({ files: [file('feature.ts')] });
  const b = reviewFixture({
    headOid: 'c'.repeat(40),
    baseOid: 'd'.repeat(40),
    mergeBaseOid: 'd'.repeat(40),
    files: [file('feature.ts')],
  });
  expect(compareReviewRevisions(a, b, empty).files).toEqual([
    {
      path: 'feature.ts',
      change: 'unchanged',
      headChanged: false,
      baseChanged: false,
    },
  ]);
});
it('affects changed-step owners and changed fingerprints, reports new/gone decisions and invalid marks', () => {
  const a = reviewFixture({
    ...before,
    layers: [
      layer('owner', 'same'),
      layer('editorial', 'old'),
      layer('gone', 'gone'),
      layer('context', 'same', 'changed', 'context'),
    ],
  });
  const b = reviewFixture({
    ...after,
    layers: [
      layer('owner', 'same'),
      layer('editorial', 'new', 'same'),
      layer('new', 'new', 'entered'),
      layer('context', 'same', 'changed', 'context'),
    ],
  });
  expect(
    compareReviewRevisions(a, b, {
      ...empty,
      marks: {
        files: [],
        decisions: [
          { layerId: 'owner', fingerprint: 'same', reviewedAt: a.publishedAt },
          {
            layerId: 'editorial',
            fingerprint: 'old',
            reviewedAt: a.publishedAt,
          },
          { layerId: 'gone', fingerprint: 'gone', reviewedAt: a.publishedAt },
        ],
      },
    }).decisions,
  ).toEqual({
    affected: ['owner', 'editorial', 'new'],
    new: ['new'],
    gone: ['gone'],
    resetMarks: [
      { layerId: 'editorial', fingerprint: 'old' },
      { layerId: 'gone', fingerprint: 'gone' },
    ],
  });
});
it('carries file marks by head blob even for a base-only change and resets changed head blobs', () => {
  const files = ['same', 'base-only', 'changed'].map((path) => ({
    path,
    fingerprint: 'head',
    reviewedAt: before.publishedAt,
    stale: false,
  }));
  expect(
    compareReviewRevisions(before, after, {
      ...empty,
      marks: { files, decisions: [] },
    }).fileMarks,
  ).toEqual({
    carriedCount: 2,
    carried: [
      { path: 'same', headBlobOid: 'head' },
      { path: 'base-only', headBlobOid: 'head' },
    ],
    reset: [{ path: 'changed', headBlobOid: 'head' }],
  });
});
it('reports recommendation, removal explanations, deleted files and not-proven additions and drops', () => {
  const oldRemoval = {
    behavior: 'Old behavior',
    why: 'Replaced',
    paths: ['old.ts'],
  };
  const newRemoval = {
    behavior: 'New removal',
    why: 'Unused',
    paths: ['new.ts'],
  };
  const oldGap = { what: 'Phone', why: 'Unavailable' };
  const newGap = { what: 'Desktop', why: 'Mac off' };
  const a = reviewFixture({
    files: [deleted('old.ts')],
    verdict: {
      ...before.verdict,
      recommendation: 'hold',
      removed: [oldRemoval],
      notProven: [oldGap],
    },
  });
  const b = reviewFixture({
    files: [deleted('new.ts')],
    verdict: { ...after.verdict, removed: [newRemoval], notProven: [newGap] },
  });
  expect(compareReviewRevisions(a, b, empty).verdict).toEqual({
    recommendation: { from: 'hold', to: 'merge' },
    removed: { added: [newRemoval], dropped: [oldRemoval] },
    deletedFiles: { added: ['new.ts'], dropped: ['old.ts'] },
    notProven: { added: [newGap], dropped: [oldGap] },
  });
});
it('uses message creation after A and current resolution, excluding reviewer messages and the boundary instant', () => {
  const message = {
    id: 'old',
    body: 'Earlier',
    author: 'agent' as const,
    createdAt: before.publishedAt,
  };
  const comparison = compareReviewRevisions(before, after, {
    ...empty,
    threads: [
      {
        id: 'thread',
        worktreeId: '',
        anchor: { kind: 'change' },
        revision: 3,
        resolved: true,
        messages: [
          message,
          {
            ...message,
            id: 'new',
            body: 'Updated',
            createdAt: '2026-10-19T01:00:00.000Z',
          },
          {
            ...message,
            id: 'reviewer',
            author: 'reviewer',
            createdAt: '2026-10-19T02:00:00.000Z',
          },
          { ...message, id: 'unknown', createdAt: undefined },
        ],
      },
    ],
  });
  expect(comparison.conversation).toEqual({
    agentMessageCount: 1,
    agentThreadIds: ['thread'],
    agentMessages: [
      {
        threadId: 'thread',
        messageId: 'new',
        body: 'Updated',
        createdAt: '2026-10-19T01:00:00.000Z',
      },
    ],
    resolvedThreadCount: 1,
    resolvedThreadIds: ['thread'],
  });
  expect(comparison.unknown).toEqual([
    {
      area: 'conversation',
      reason: 'An agent message has no usable creation timestamp.',
      ids: ['thread', 'unknown'],
    },
  ]);
});
it('reports B checks and changed results by unique name and target, with duplicate identities unknown', () => {
  const a = reviewFixture({
    proof: {
      checks: [
        { name: 'test', result: 'fail' },
        { name: 'test', layerId: 'other', result: 'pass' },
        { name: 'duplicate', result: 'pass' },
        { name: 'duplicate', result: 'fail' },
      ],
      assets: [],
    },
  });
  const checks = [
    { name: 'test', result: 'pass' as const },
    {
      name: 'test',
      layerId: 'other',
      result: 'pass' as const,
      output: 'New output',
    },
    { name: 'duplicate', result: 'pass' as const },
    { name: 'new', result: 'pass' as const },
  ];
  const comparison = compareReviewRevisions(
    a,
    reviewFixture({ proof: { checks, assets: [] } }),
    empty,
  );
  expect(comparison.proof).toEqual({
    publishedChecks: checks,
    changedResults: [
      {
        from: { name: 'test', result: 'fail' },
        to: { name: 'test', result: 'pass' },
      },
    ],
  });
  expect(comparison.unknown).toEqual([
    {
      area: 'proof',
      reason:
        'Check names and targets are not unique; the result delta is unknown.',
      ids: ['["duplicate",null,null]'],
    },
  ]);
});
it('keeps marks outside the target manifest unknown instead of inventing their blob validity', () => {
  const comparison = compareReviewRevisions(before, after, {
    ...empty,
    marks: {
      decisions: [],
      files: [
        {
          path: 'context.ts',
          fingerprint: 'blob',
          reviewedAt: before.publishedAt,
          stale: false,
        },
      ],
    },
  });
  expect(comparison.unknown).toEqual([
    {
      area: 'file-marks',
      reason:
        'The marked path is absent from the target manifest; its head blob may still exist unchanged.',
      ids: ['context.ts'],
    },
  ]);
  expect(comparison.fileMarks).toEqual({
    carriedCount: 0,
    carried: [],
    reset: [],
  });
});

it('does not reset a mark merely because the base caught up and the file left the review', () => {
  const a = reviewFixture({ files: [file('caught-up.ts')] });
  const b = reviewFixture({
    revision: 2,
    baseOid: 'new-main',
    headOid: 'rebased-head',
    files: [],
  });
  const comparison = compareReviewRevisions(a, b, {
    ...empty,
    marks: {
      decisions: [],
      files: [
        {
          path: 'caught-up.ts',
          fingerprint: 'head',
          reviewedAt: a.publishedAt,
          stale: false,
        },
      ],
    },
  });
  expect(comparison.files).toEqual([
    {
      path: 'caught-up.ts',
      change: 'left',
    },
  ]);
  expect(comparison.fileMarks).toEqual({
    carriedCount: 0,
    carried: [],
    reset: [],
  });
  expect(comparison.unknown).toEqual([
    {
      area: 'file-marks',
      reason:
        'The marked path is absent from the target manifest; its head blob may still exist unchanged.',
      ids: ['caught-up.ts'],
    },
  ]);
});
