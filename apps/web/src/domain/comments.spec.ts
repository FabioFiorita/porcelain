import { describe, expect, it } from 'vitest';
import {
  type CommentAnchor,
  type CommentTarget,
  commentIsStale,
  matchesCommentTarget,
  rangeAnchor,
} from './comments';

const target: CommentTarget = {
  filePath: 'a.ts',
  comparison: { kind: 'worktree', scope: 'staged' },
  contentFingerprint: 'snapshot-a',
};
const anchor: CommentAnchor = {
  ...target,
  kind: 'codeRange',
  startLine: 3,
  endLine: 8,
  side: 'deletions',
};

describe('comment evidence identity', () => {
  it('never places staged lines on the unstaged comparison or source file', () => {
    expect(matchesCommentTarget(anchor, target)).toBe(true);
    expect(
      matchesCommentTarget(anchor, {
        ...target,
        comparison: { kind: 'worktree', scope: 'unstaged' },
      }),
    ).toBe(false);
    expect(
      matchesCommentTarget(anchor, { ...target, comparison: { kind: 'file' } }),
    ).toBe(false);
    expect(
      matchesCommentTarget({ ...anchor, comparison: undefined }, target),
    ).toBe(false);
  });
  it('isolates merge-parent comments and detects changed worktree evidence', () => {
    const commit = {
      ...anchor,
      revision: 'a'.repeat(40),
      comparison: { kind: 'commit' as const, parent: 2 },
    };
    expect(
      matchesCommentTarget(commit, {
        ...commit,
        comparison: { kind: 'commit', parent: 1 },
      }),
    ).toBe(false);
    expect(
      matchesCommentTarget(commit, { ...commit, revision: 'b'.repeat(40) }),
    ).toBe(false);
    expect(
      commentIsStale(anchor, { ...target, contentFingerprint: 'snapshot-b' }),
    ).toBe(true);
    expect(commentIsStale(anchor, target)).toBe(false);
  });
  it('normalizes reverse drags without mixing old and new line numbers', () => {
    expect(
      rangeAnchor(target, { start: 8, end: 3, side: 'deletions' }),
    ).toMatchObject({ startLine: 3, endLine: 8, side: 'deletions' });
    expect(
      rangeAnchor(target, {
        start: 8,
        end: 3,
        side: 'deletions',
        endSide: 'additions',
      }),
    ).toBeNull();
    expect(
      rangeAnchor(
        { ...target, comparison: { kind: 'file' } },
        { start: 3, end: 8 },
      ),
    ).not.toHaveProperty('side');
  });
});
