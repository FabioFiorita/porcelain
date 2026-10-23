import { describe, expect, it } from 'vitest';
import {
  matchesCommentTarget,
  rangeAnchor,
  type CommentAnchor,
  type CommentTarget,
} from '@porcelain/client/reviews/rules';
import {
  codeCommentMatches,
  codeCommentStale,
  retainedCommentTarget,
} from './retained-comments';

const r1 = '1'.repeat(40);
const r3 = '3'.repeat(40);
const target: CommentTarget = {
  filePath: 'owner.ts',
  revision: r3,
  comparison: { kind: 'branch', base: 'main' },
};

describe('retained discussion placement', () => {
  it.each(
    [
      {
        name: 'r1 line moved in r3',
        revision: r1,
        base: 'main',
        retained: true,
        stale: true,
      },
      {
        name: 'r3 code read at r1',
        revision: r3,
        base: 'main',
        retained: true,
        shown: r1,
        stale: true,
      },
      {
        name: 'matching publication',
        revision: r3,
        base: 'main',
        retained: true,
        stale: false,
      },
      {
        name: 'same head republished',
        revision: r3,
        base: 'main',
        retained: true,
        original: 1,
        stale: true,
      },
      {
        name: 'different comparison base',
        revision: r3,
        base: 'release',
        retained: true,
        stale: true,
      },
      {
        name: 'ordinary branch discussion across heads',
        revision: r1,
        base: 'main',
        retained: false,
        stale: false,
      },
      {
        name: 'missing original revision',
        revision: undefined,
        base: 'main',
        retained: true,
        stale: true,
      },
    ].flatMap((row) =>
      ['additions', 'deletions'].map((side) => ({ ...row, side })),
    ),
  )(
    '$name ($side) stays readable and only matching code gets an inline thread',
    ({ revision, base, retained, shown, stale, original, side }) => {
      const anchor: CommentAnchor = {
        kind: 'codeRange',
        filePath: 'owner.ts',
        startLine: 5,
        endLine: 5,
        side: side === 'deletions' ? 'deletions' : 'additions',
        ...(revision ? { revision } : {}),
        comparison: { kind: 'branch', base },
      };
      const displayed = { ...target, revision: shown ?? r3 };
      expect(matchesCommentTarget(anchor, displayed)).toBe(true);
      expect(
        codeCommentStale(
          anchor,
          displayed,
          retained
            ? { revision: 3, commentRevision: original ?? 3, kind: 'diff' }
            : undefined,
        ),
      ).toBe(stale);
    },
  );

  it.each([
    { kind: 'file', side: 'deletions', stale: true },
    { kind: 'file', side: 'additions', stale: false },
    { kind: 'diff', side: 'deletions', stale: false },
  ] as const)(
    'places $side discussion safely in a retained $kind view',
    ({ kind, side, stale }) => {
      expect(
        codeCommentStale(
          {
            kind: 'codeRange',
            filePath: 'owner.ts',
            revision: r3,
            comparison: { kind: 'branch', base: 'main' },
            startLine: 5,
            endLine: 5,
            side,
          },
          target,
          { revision: 3, commentRevision: 3, kind },
        ),
      ).toBe(stale);
    },
  );

  it.each([
    { name: 'legacy range without comparison evidence', comparison: undefined },
    {
      name: 'range on a commit comparison',
      comparison: { kind: 'commit', parent: 1 },
    },
    { name: 'range on a file comparison', comparison: { kind: 'file' } },
  ] as const)(
    'keeps a $name readable at file level in a retained review',
    ({ comparison }) => {
      const anchor: CommentAnchor = {
        kind: 'codeRange',
        filePath: 'owner.ts',
        ...(comparison?.kind === 'file' ? {} : { revision: r3 }),
        startLine: 5,
        endLine: 5,
        ...(comparison ? { comparison } : {}),
      };
      expect(codeCommentMatches(anchor, target, true)).toBe(true);
      expect(codeCommentMatches(anchor, target, false)).toBe(false);
      expect(
        codeCommentStale(anchor, target, {
          revision: 3,
          commentRevision: 3,
          kind: 'file',
        }),
      ).toBe(true);
    },
  );

  it.each([
    { kind: 'change' },
    { kind: 'file', filePath: 'another-owner.ts' },
  ] as const)(
    'keeps an unrelated $kind discussion off this retained file',
    (anchor) => {
      expect(codeCommentMatches(anchor, target, true)).toBe(false);
    },
  );

  it('keeps fingerprint conflicts at file level on the current branch', () => {
    expect(
      codeCommentStale(
        { kind: 'file', filePath: 'owner.ts', contentFingerprint: 'old' },
        { ...target, contentFingerprint: 'new' },
        undefined,
      ),
    ).toBe(true);
  });

  it.each(['file', 'range'] as const)(
    'anchors an unchanged context %s comment to the retained branch code',
    (kind) => {
      const context = retainedCommentTarget(
        { headOid: r1, base: 'main' },
        'context.ts',
      );
      const anchor =
        kind === 'file'
          ? { ...context, kind: 'file' }
          : rangeAnchor(context, { start: 2, end: 4 });
      expect(anchor).toEqual({
        kind: kind === 'file' ? 'file' : 'codeRange',
        filePath: 'context.ts',
        revision: r1,
        comparison: { kind: 'branch', base: 'main' },
        ...(kind === 'range'
          ? { startLine: 2, endLine: 4, side: 'additions' }
          : {}),
      });
    },
  );
});
