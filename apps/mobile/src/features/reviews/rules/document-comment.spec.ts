import { expect, it } from 'vitest';
import { matchesCommentTarget } from '@porcelain/client/reviews/rules';
import {
  commitCommentTarget,
  documentCommentAnchor,
  savedFileCommentTarget,
} from './document-comment';

it('only anchors saved Files text with server evidence', () => {
  expect(savedFileCommentTarget('app.css', undefined)).toBeUndefined();
  expect(savedFileCommentTarget('app.css', '')).toBeUndefined();
  expect(
    documentCommentAnchor(undefined, { startLine: 1, endLine: 2 }),
  ).toBeUndefined();
  expect(
    documentCommentAnchor(
      savedFileCommentTarget('app.css', 'saved-css'),
      undefined,
    ),
  ).toEqual({
    kind: 'file',
    filePath: 'app.css',
    comparison: { kind: 'file' },
    contentFingerprint: 'saved-css',
  });
});

it('normalizes a native Files range into whole lines without diff side or revision', () => {
  expect(
    documentCommentAnchor(savedFileCommentTarget('app.css', 'saved-css'), {
      startLine: 9,
      endLine: 3,
      side: 'additions',
    }),
  ).toEqual({
    kind: 'codeRange',
    filePath: 'app.css',
    comparison: { kind: 'file' },
    contentFingerprint: 'saved-css',
    startLine: 3,
    endLine: 9,
  });
});

it.each(['additions', 'deletions'] as const)(
  'keeps the selected commit, parent and %s side in History',
  (side) => {
    const target = commitCommentTarget('src/file.ts', 'a'.repeat(40), 2);
    const anchor = documentCommentAnchor(target, {
      startLine: 8,
      endLine: 6,
      side,
    });
    expect(anchor).toEqual({
      kind: 'codeRange',
      filePath: 'src/file.ts',
      revision: 'a'.repeat(40),
      comparison: { kind: 'commit', parent: 2 },
      side,
      startLine: 6,
      endLine: 8,
    });
    expect(
      anchor &&
        matchesCommentTarget(
          anchor,
          commitCommentTarget('src/file.ts', 'a'.repeat(40), 1),
        ),
    ).toBe(false);
    expect(
      anchor &&
        matchesCommentTarget(
          anchor,
          commitCommentTarget('src/file.ts', 'b'.repeat(40), 2),
        ),
    ).toBe(false);
  },
);

it('keeps immutable History evidence for whole-file comments too', () => {
  expect(
    documentCommentAnchor(
      commitCommentTarget('src/file.ts', 'b'.repeat(40), 1),
      undefined,
    ),
  ).toEqual({
    kind: 'file',
    filePath: 'src/file.ts',
    revision: 'b'.repeat(40),
    comparison: { kind: 'commit', parent: 1 },
  });
});

it('preserves worktree and branch evidence through native range normalization', () => {
  expect(
    documentCommentAnchor(
      {
        filePath: 'src/file.ts',
        contentFingerprint: 'review-snapshot',
        comparison: { kind: 'worktree', scope: 'staged' },
      },
      {
        startLine: 4,
        endLine: 4,
        side: 'deletions',
      },
    ),
  ).toEqual({
    kind: 'codeRange',
    filePath: 'src/file.ts',
    contentFingerprint: 'review-snapshot',
    comparison: { kind: 'worktree', scope: 'staged' },
    startLine: 4,
    endLine: 4,
    side: 'deletions',
  });
  expect(
    documentCommentAnchor(
      {
        filePath: 'src/file.ts',
        revision: 'c'.repeat(40),
        comparison: { kind: 'branch', base: 'refs/heads/main' },
        contentFingerprint: 'branch-snapshot',
      },
      {
        startLine: 4,
        endLine: 6,
      },
    ),
  ).toEqual({
    kind: 'codeRange',
    filePath: 'src/file.ts',
    revision: 'c'.repeat(40),
    comparison: { kind: 'branch', base: 'refs/heads/main' },
    contentFingerprint: 'branch-snapshot',
    startLine: 4,
    endLine: 6,
    side: 'additions',
  });
});

it('does not turn an untracked source selection into a diff-side anchor', () => {
  expect(
    documentCommentAnchor(
      {
        filePath: 'new.css',
        comparison: { kind: 'worktree', scope: 'untracked' },
        contentFingerprint: 'saved-untracked',
      },
      {
        startLine: 1,
        endLine: 3,
        side: 'additions',
      },
    ),
  ).toEqual({
    kind: 'codeRange',
    filePath: 'new.css',
    comparison: { kind: 'worktree', scope: 'untracked' },
    contentFingerprint: 'saved-untracked',
    startLine: 1,
    endLine: 3,
  });
});
