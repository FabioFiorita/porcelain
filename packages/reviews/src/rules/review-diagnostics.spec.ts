import { describe, expect, it } from 'vitest';
import type { ReviewPatch } from '../models/review-evidence.ts';
import { reviewDiagnostics } from './review-diagnostics.ts';

const path = 'notes.txt';
const headerLikeContent = [
  { name: 'increment', content: '++counter;' },
  { name: 'decrement', content: '--counter;' },
  { name: 'old file header', content: '--- a/nested.txt' },
  { name: 'new file header', content: '+++ b/nested.txt' },
  { name: 'section header', content: 'diff --git a/nested.txt b/nested.txt' },
  { name: 'hunk header', content: '@@ -1 +1 @@' },
  { name: 'long file header', content: `+++ ${'long content '.repeat(1000)}` },
];

function textPatch(
  scope: 'staged' | 'unstaged',
  lines: readonly string[],
): ReviewPatch {
  return {
    path,
    scope,
    kind: 'text',
    patch: [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      ...lines,
      '',
    ].join('\n'),
  };
}

function positions(patches: readonly ReviewPatch[]) {
  const result = reviewDiagnostics([], new Map(), patches);
  return {
    changed: [...(result.changed.get(path) ?? [])].sort((a, b) => a - b),
    deleted: [...(result.deleted.get(path) ?? [])].sort((a, b) => a - b),
    binary: [...result.binary],
  };
}

describe('reviewDiagnostics', () => {
  describe.each(['staged', 'unstaged'] as const)('%s hunk content', (scope) => {
    it.each(headerLikeContent)(
      'retains $name content in an addition and the following line positions',
      ({ content }) => {
        expect(
          positions([
            textPatch(scope, [
              '@@ -4,2 +4,4 @@',
              ' before',
              `+${content}`,
              ' after',
              '+tail',
            ]),
          ]),
        ).toEqual({ changed: [5, 7], deleted: [], binary: [] });
      },
    );

    it.each(headerLikeContent)(
      'retains $name content in a removal',
      ({ content }) => {
        expect(
          positions([
            textPatch(scope, [
              '@@ -4,3 +4,2 @@',
              ' before',
              `-${content}`,
              ' after',
            ]),
          ]),
        ).toEqual({ changed: [5], deleted: [5], binary: [] });
      },
    );
  });

  it.each([
    {
      name: 'insertion moves a staged addition forward',
      staged: ['@@ -5,0 +6 @@', '+staged'],
      unstaged: ['@@ -2,0 +3 @@', '+++counter;'],
      changed: [3, 7],
      deleted: [],
    },
    {
      name: 'insertion moves a staged deletion forward',
      staged: ['@@ -5 +4,0 @@', '-staged'],
      unstaged: ['@@ -2,0 +3 @@', '++++ b/nested.txt'],
      changed: [3, 5],
      deleted: [5],
    },
    {
      name: 'removal moves a staged addition back',
      staged: ['@@ -5,0 +6 @@', '+staged'],
      unstaged: ['@@ -3 +2,0 @@', '---counter;'],
      changed: [2, 5],
      deleted: [2],
    },
    {
      name: 'removal moves a staged deletion back',
      staged: ['@@ -5 +4,0 @@', '-staged'],
      unstaged: ['@@ -3 +2,0 @@', '---- a/nested.txt'],
      changed: [2, 3],
      deleted: [2, 3],
    },
    {
      name: 'removal drops the staged line that no longer exists',
      staged: ['@@ -2,0 +3,2 @@', '+--counter;', '+second'],
      unstaged: ['@@ -3 +2,0 @@', '---counter;'],
      changed: [2, 3],
      deleted: [2],
    },
    {
      name: 'context resembling metadata preserves staged positions',
      staged: ['@@ -4,0 +5 @@', '++++ b/nested.txt'],
      unstaged: [
        '@@ -3,3 +3,4 @@',
        ' diff --git a/nested.txt b/nested.txt',
        ' --- a/nested.txt',
        '+inserted',
        ' +++ b/nested.txt',
      ],
      changed: [5, 6],
      deleted: [],
    },
  ])(
    'maps staged changes when $name',
    ({ staged, unstaged, changed, deleted }) => {
      expect(
        positions([
          textPatch('staged', staged),
          textPatch('unstaged', unstaged),
        ]),
      ).toEqual({ changed, deleted, binary: [] });
    },
  );

  it('ignores file metadata between sections and resets positions at each hunk', () => {
    expect(
      positions([
        textPatch('unstaged', [
          '@@ -1 +1 @@',
          '-old',
          '+new',
          '\\ No newline at end of file',
          '@@ -10 +10,2 @@',
          ' context',
          '+later',
          'diff --git a/notes.txt b/notes.txt',
          '--- /dev/null',
          '+++ b/notes.txt',
          '@@ -0,0 +1 @@',
          '+replacement',
        ]),
      ]),
    ).toEqual({ changed: [1, 11], deleted: [1], binary: [] });
  });

  it('anchors a pure deletion at the first line', () => {
    expect(
      positions([textPatch('unstaged', ['@@ -1,2 +0,0 @@', '-one', '-two'])]),
    ).toEqual({ changed: [1], deleted: [1], binary: [] });
  });

  it.each([
    '',
    'diff --git a/notes.txt b/notes.txt\n--- a/notes.txt\n+++ b/notes.txt',
  ])('ignores a patch without hunks: %j', (patch) => {
    expect(
      positions([{ path, scope: 'unstaged', kind: 'text', patch }]),
    ).toEqual({
      changed: [],
      deleted: [],
      binary: [],
    });
  });

  it('returns no diagnostics when there are no changes', () => {
    expect(reviewDiagnostics([], new Map(), [])).toEqual({
      changed: new Map(),
      deleted: new Map(),
      binary: new Set(),
    });
  });

  it.each([
    { text: 'one\ntwo\n', lines: [1, 2] },
    { text: 'one\ntwo', lines: [1, 2] },
    { text: '', lines: [] },
    { text: undefined, lines: [] },
  ])('counts actual untracked lines for %j', ({ text, lines }) => {
    const result = reviewDiagnostics(
      [{ path, untracked: true, deleted: false }],
      new Map(text === undefined ? [] : [[path, text]]),
      [],
    );
    expect(result).toEqual({
      changed: new Map([[path, new Set(lines)]]),
      deleted: new Map(),
      binary: new Set(),
    });
  });

  it.each(['staged', 'unstaged'] as const)(
    'records a %s binary patch without line positions',
    (scope) => {
      expect(positions([{ path, scope, kind: 'binary' }])).toEqual({
        changed: [],
        deleted: [],
        binary: [path],
      });
    },
  );
});
