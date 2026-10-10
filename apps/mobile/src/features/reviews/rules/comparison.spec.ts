import { describe, expect, it } from 'vitest';
import {
  commentTarget,
  diffSelection,
  reviewFiles,
  reviewRange,
  type ReviewSnapshot,
} from './comparison';
import { rangeAnchor } from '@porcelain/client/reviews/rules';

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

describe('mobile review comparisons', () => {
  it('keeps both rename paths in a staged diff selection', () => {
    expect(diffSelection(staged)).toEqual({
      scope: 'staged',
      oldPath: 'old.ts',
      newPath: 'new.ts',
    });
  });
  it('never submits an untracked path as a staged or unstaged diff request', () => {
    expect(
      diffSelection({ scope: 'untracked', path: 'new.ts' }),
    ).toBeUndefined();
  });
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
