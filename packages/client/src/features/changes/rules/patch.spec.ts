import { expect, it } from 'vitest';
import { patchLines } from './patch.ts';

it('keeps both line numbers across multiple hunks and does not confuse content with file headers', () => {
  expect(
    patchLines(
      'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -4,2 +4,2 @@ fn\n keep\n--- old\n+++ new\n@@ -12 +12 @@\n-before\n+after\n\\ No newline at end of file\n',
    ),
  ).toEqual({
    kind: 'text',
    lines: [
      { id: 'patch:3', text: '@@ -4,2 +4,2 @@ fn' },
      { id: 'patch:4', text: 'keep', kind: 'context', oldLine: 4, newLine: 4 },
      { id: 'patch:5', text: '-- old', kind: 'removed', oldLine: 5 },
      { id: 'patch:6', text: '++ new', kind: 'added', newLine: 5 },
      { id: 'patch:7', text: '@@ -12 +12 @@' },
      { id: 'patch:8', text: 'before', kind: 'removed', oldLine: 12 },
      { id: 'patch:9', text: 'after', kind: 'added', newLine: 12 },
      { id: 'patch:10', text: '\\ No newline at end of file' },
    ],
  });
});

it('handles added and deleted files with an empty side and blank content lines', () => {
  expect(patchLines('@@ -0,0 +1,2 @@\n+hello\n+\n')).toEqual({
    kind: 'text',
    lines: [
      { id: 'patch:0', text: '@@ -0,0 +1,2 @@' },
      { id: 'patch:1', text: 'hello', kind: 'added', newLine: 1 },
      { id: 'patch:2', text: '', kind: 'added', newLine: 2 },
    ],
  });
  expect(patchLines('@@ -1 +0,0 @@\n-goodbye')).toEqual({
    kind: 'text',
    lines: [
      { id: 'patch:0', text: '@@ -1 +0,0 @@' },
      { id: 'patch:1', text: 'goodbye', kind: 'removed', oldLine: 1 },
    ],
  });
});

it('reports empty content and context-only patches without a blank diff', () => {
  expect(patchLines('')).toEqual({ kind: 'empty' });
  expect(patchLines('@@ -1 +1 @@\n unchanged\n')).toEqual({ kind: 'empty' });
});

it.each([
  ['missing patch', 'not a patch'],
  [
    'metadata without a hunk',
    'diff --git a/a b/a\nold mode 100644\nnew mode 100755',
  ],
  ['combined hunk', '@@@ -1 +1 @@@\n-a\n+b'],
  ['incomplete hunk', '@@ -1,2 +1 @@\n-a\n+b'],
  ['overfull hunk', '@@ -1 +1 @@\n-a\n+b\n+c'],
  ['interrupted hunk', '@@ -1 +1 @@\n-a\n@@ -3 +3 @@\n-c\n+d'],
  ['negative remaining count', '@@ -0,0 +1 @@\n context'],
])('rejects %s instead of displaying a partial diff', (_name, patch) => {
  expect(patchLines(patch)).toEqual({ kind: 'invalid' });
});

it('preserves carriage returns in CRLF file content and markers on either side', () => {
  expect(
    patchLines(
      '@@ -1 +1 @@\n-old\r\n\\ No newline at end of file\n+new\r\n\\ No newline at end of file\n',
    ),
  ).toEqual({
    kind: 'text',
    lines: [
      { id: 'patch:0', text: '@@ -1 +1 @@' },
      { id: 'patch:1', text: 'old\r', kind: 'removed', oldLine: 1 },
      { id: 'patch:2', text: '\\ No newline at end of file' },
      { id: 'patch:3', text: 'new\r', kind: 'added', newLine: 1 },
      { id: 'patch:4', text: '\\ No newline at end of file' },
    ],
  });
});
