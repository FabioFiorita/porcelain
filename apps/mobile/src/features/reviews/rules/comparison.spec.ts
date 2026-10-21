import { rangeAnchor } from '@porcelain/client/reviews/rules';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { describe, expect, it } from 'vitest';
import {
  commentTarget,
  documentReviewTarget,
  fileReviewLabels,
  reviewFiles,
  reviewRange,
  type ReviewSnapshot,
} from './comparison';

const staged = {
  scope: 'staged',
  kind: 'renamed',
  oldPath: 'old.ts',
  newPath: 'new.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: 'a',
  newOid: 'b',
  supported: true,
} as const;
const worktree: ReviewSnapshot = {
  kind: 'worktree',
  answer: {
    environmentId: 'env',
    worktreeId: 'tree',
    statusToken: 'look',
    headOid: 'head',
    inProgress: undefined,
    mergeHeadOid: undefined,
    branch: undefined,
    changes: [
      { path: 'new.ts', fingerprint: 'current', comparisons: [staged] },
    ],
  },
};
const branch: ReviewSnapshot = {
  kind: 'branch',
  answer: {
    worktreeId: 'tree',
    head: { branch: 'feature', oid: 'tip' },
    base: { ref: 'refs/heads/main', oid: 'base' },
    mergeBaseOid: 'ancestor',
    commits: 2,
    files: [
      {
        path: 'new.ts',
        oldPath: 'old.ts',
        newPath: 'new.ts',
        status: 'renamed',
        oldMode: '100644',
        newMode: '100644',
        fingerprint: 'branch-content',
      },
    ],
  },
};
const file = {
  path: 'new.ts',
  fingerprint: 'current',
  note: 'staged',
  reviewStatus: 'unreviewed' as const,
};

describe('Files navigation review labels', () => {
  const marks = {
    worktreeId: 'tree',
    marks: [
      {
        path: 'new.ts',
        fingerprint: 'current',
        reviewedAt: '2026-10-15T00:00:00Z',
      },
    ],
  };
  const snapshot = AsyncResult.success(worktree);
  const reviewed = AsyncResult.success(marks);

  it('names only applicable files using canonical marks and fingerprints', () => {
    const changed: ReviewSnapshot = {
      ...worktree,
      answer: {
        ...worktree.answer,
        changes: [
          ...worktree.answer.changes,
          { path: 'fresh.ts', fingerprint: 'fresh', comparisons: [] },
          { path: 'changed.ts', fingerprint: 'now', comparisons: [] },
          { path: 'unknown.ts', fingerprint: undefined, comparisons: [] },
        ],
      },
    };
    expect([
      ...fileReviewLabels(
        AsyncResult.success(changed),
        AsyncResult.success({
          ...marks,
          marks: [
            ...marks.marks,
            { ...marks.marks[0]!, path: 'changed.ts', fingerprint: 'old' },
            { ...marks.marks[0]!, path: 'unknown.ts' },
            { ...marks.marks[0]!, path: 'unchanged.ts' },
          ],
        }),
      ),
    ]).toEqual([
      ['new.ts', 'Reviewed'],
      ['fresh.ts', 'Unreviewed'],
      ['changed.ts', 'Changed since review'],
      ['unknown.ts', 'Review status unavailable'],
    ]);
  });

  it.each([
    {
      name: 'initial changes',
      snapshot: AsyncResult.initial(),
      marks: reviewed,
    },
    {
      name: 'refreshing changes',
      snapshot: AsyncResult.waiting(snapshot),
      marks: reviewed,
    },
    {
      name: 'failed changes retaining old data',
      snapshot: AsyncResult.failWithPrevious('offline', {
        previous: Option.some(snapshot),
      }),
      marks: reviewed,
    },
    { name: 'initial marks', snapshot, marks: AsyncResult.initial() },
    {
      name: 'refreshing marks',
      snapshot,
      marks: AsyncResult.waiting(reviewed),
    },
    {
      name: 'failed marks retaining old data',
      snapshot,
      marks: AsyncResult.failWithPrevious('offline', {
        previous: Option.some(reviewed),
      }),
    },
  ])('does not present $name as reviewed', ({ snapshot, marks }) => {
    expect([...fileReviewLabels(snapshot, marks)]).toEqual([]);
  });

  it('updates on mark removal, changed content and a different comparison', () => {
    expect([...fileReviewLabels(snapshot, reviewed)]).toEqual([
      ['new.ts', 'Reviewed'],
    ]);
    expect([
      ...fileReviewLabels(
        snapshot,
        AsyncResult.success({ worktreeId: 'tree', marks: [] }),
      ),
    ]).toEqual([['new.ts', 'Unreviewed']]);
    expect([
      ...fileReviewLabels(AsyncResult.success(branch), reviewed),
    ]).toEqual([['new.ts', 'Changed since review']]);
    expect([
      ...fileReviewLabels(
        AsyncResult.success({
          ...worktree,
          answer: { ...worktree.answer, worktreeId: 'other', changes: [] },
        }),
        AsyncResult.success({ worktreeId: 'other', marks: [] }),
      ),
    ]).toEqual([]);
  });
});

describe('mobile review comparisons', () => {
  it('uses branch reviewed marks independently from worktree marks', () => {
    expect(reviewRange(branch)).toEqual({
      kind: 'branch',
      base: 'refs/heads/main',
      branch: 'feature',
    });
  });
  it('reports changed code as stale rather than reviewed', () => {
    expect(
      reviewFiles(worktree, {
        worktreeId: 'tree',
        marks: [
          {
            path: 'new.ts',
            fingerprint: 'previous',
            reviewedAt: '2026-10-10T00:00:00Z',
          },
        ],
      })[0]?.reviewStatus,
    ).toBe('stale');
  });
  it('anchors deleted-line feedback to the displayed staged fingerprint', () => {
    const target = commentTarget(worktree, file, 'staged');
    expect(
      target && rangeAnchor(target, { start: 9, end: 8, side: 'deletions' }),
    ).toEqual({
      kind: 'codeRange',
      filePath: 'new.ts',
      comparison: { kind: 'worktree', scope: 'staged' },
      contentFingerprint: 'current',
      startLine: 8,
      endLine: 9,
      side: 'deletions',
    });
  });
  it('binds branch feedback to the displayed base and tip', () => {
    expect(
      commentTarget(branch, { ...file, fingerprint: 'branch-content' }),
    ).toEqual({
      filePath: 'new.ts',
      comparison: { kind: 'branch', base: 'refs/heads/main' },
      revision: 'tip',
      contentFingerprint: 'branch-content',
    });
  });
  it('does not offer file feedback without a known content fingerprint', () => {
    expect(
      commentTarget(worktree, { ...file, fingerprint: undefined }, 'unstaged'),
    ).toBeUndefined();
  });
});

it('does not submit branch feedback without a base', () => {
  expect(
    commentTarget(
      { ...branch, answer: { ...branch.answer, base: undefined } },
      file,
    ),
  ).toBeUndefined();
});
it('does not submit worktree feedback without a comparison scope', () => {
  expect(commentTarget(worktree, file)).toBeUndefined();
});

it('binds document comments to the selected worktree scope and falls back only to an available comparison', () => {
  const snapshot: ReviewSnapshot = {
    ...worktree,
    answer: {
      ...worktree.answer,
      changes: [
        {
          path: 'new.ts',
          fingerprint: 'current',
          comparisons: [staged, { ...staged, scope: 'unstaged' }],
        },
      ],
    },
  };
  expect(documentReviewTarget(snapshot, 'new.ts', 'unstaged')).toEqual({
    filePath: 'new.ts',
    contentFingerprint: 'current',
    comparison: { kind: 'worktree', scope: 'unstaged' },
  });
  expect(documentReviewTarget(snapshot, 'new.ts', 'untracked')).toEqual({
    filePath: 'new.ts',
    contentFingerprint: 'current',
    comparison: { kind: 'worktree', scope: 'staged' },
  });
});
it('keeps document comments disabled when a comparison disappears or its snapshot is unavailable', () => {
  expect(documentReviewTarget(undefined, 'new.ts', 'staged')).toBeUndefined();
  expect(documentReviewTarget(worktree, 'gone.ts', 'staged')).toBeUndefined();
});
it('uses the displayed branch rename destination and snapshot evidence for a document', () => {
  expect(documentReviewTarget(branch, 'new.ts', undefined)).toEqual({
    filePath: 'new.ts',
    contentFingerprint: 'branch-content',
    revision: 'tip',
    comparison: { kind: 'branch', base: 'refs/heads/main' },
  });
  expect(documentReviewTarget(branch, 'old.ts', undefined)).toBeUndefined();
});
