import { expect, it } from 'vitest';
import { contextPatch, focusPatch, spansLabel } from './patch-focus.ts';

it('focuses a patch with shared line accounting and preserves no-newline markers', () => {
  expect(
    focusPatch(
      'diff --git a/a b/a\n@@ -1,3 +1,3 @@\n first\n-before\n+after\n\\ No newline at end of file\n last\n',
      [{ startLine: 2, endLine: 2 }],
      0,
    ),
  ).toBe(
    'diff --git a/a b/a\n@@ -2,1 +2,1 @@\n-before\n+after\n\\ No newline at end of file\n',
  );
});
it.each([
  ['invalid counts', '@@ -1,2 +1 @@\n-a\n+b'],
  ['combined diff', '@@@ -1 +1 @@@\n-a\n+b'],
  ['no matching span', '@@ -1 +1 @@\n-a\n+b'],
])('refuses to invent focused content for %s', (_reason, patch) => {
  expect(focusPatch(patch, [{ startLine: 100, endLine: 100 }])).toBeNull();
});
it('keeps empty patches empty and includes the default surrounding context', () => {
  expect(focusPatch('', [{ startLine: 1, endLine: 1 }])).toBe('');
  expect(
    focusPatch('@@ -1,3 +1,3 @@\n first\n-before\n+after\n last\n', [
      { startLine: 2, endLine: 2 },
    ]),
  ).toBe('@@ -1,3 +1,3 @@\n first\n-before\n+after\n last\n');
});
it('builds context-only hunks with quoted paths and labels single and multiple spans', () => {
  expect(contextPatch('a file.ts', 4, ['one', 'two'])).toBe(
    'diff --git "a/a file.ts" "b/a file.ts"\n--- "a/a file.ts"\n+++ "b/a file.ts"\n@@ -4,2 +4,2 @@\n one\n two\n',
  );
  expect(spansLabel([{ startLine: 4, endLine: 4 }])).toBe('Line 4');
  expect(
    spansLabel([
      { startLine: 4, endLine: 7 },
      { startLine: 9, endLine: 9 },
    ]),
  ).toBe('Lines 4–7, 9');
});
