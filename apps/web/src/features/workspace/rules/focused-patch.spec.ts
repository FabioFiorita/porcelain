import { expect, it } from 'vitest';
import { focusedPatch } from './focused-patch';

const header = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts';
it('keeps only the step and three surrounding head lines with valid hunk counts', () => {
  const patch = `${header}\n@@ -1,8 +1,8 @@ owner\n one\n two\n-old\n+new\n four\n five\n six\n seven\n eight\n@@ -30 +30 @@\n-later\n+unrelated\n`;
  expect(focusedPatch(patch, { startLine: 3, endLine: 3 })).toBe(
    `${header}\n@@ -1,6 +1,6 @@ owner\n one\n two\n-old\n+new\n four\n five\n six\n`,
  );
});
it('returns no slice when the step does not overlap a hunk', () => {
  expect(
    focusedPatch(`${header}\n@@ -1 +1 @@\n-old\n+new\n`, {
      startLine: 40,
      endLine: 41,
    }),
  ).toBeUndefined();
  expect(
    focusedPatch('binary file', { startLine: 1, endLine: 1 }),
  ).toBeUndefined();
});
it('retains an addition-only hunk with its zero-length base coordinate', () => {
  expect(
    focusedPatch(`${header}\n@@ -0,0 +1,2 @@\n+one\n+two\n`, {
      startLine: 1,
      endLine: 1,
    }),
  ).toBe(`${header}\n@@ -0,0 +1,2 @@\n+one\n+two\n`);
});
it('keeps the no-newline marker attached to the final included row', () => {
  expect(
    focusedPatch(
      `${header}\n@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file\n`,
      { startLine: 1, endLine: 1 },
    ),
  ).toBe(
    `${header}\n@@ -1,1 +1,1 @@\n-old\n+new\n\\ No newline at end of file\n`,
  );
});

it('does not replace the pointed code with a hunk that ends before the range', () => {
  expect(
    focusedPatch(`${header}\n@@ -16,2 +16,2 @@\n-old\n+new\n context\n`, {
      startLine: 20,
      endLine: 22,
    }),
  ).toBeUndefined();
});

it('keeps the insertion boundary when the base hunk has zero lines after a nonzero offset', () => {
  expect(
    focusedPatch(`${header}\n@@ -5,0 +6,2 @@\n+one\n+two\n`, {
      startLine: 6,
      endLine: 7,
    }),
  ).toBe(`${header}\n@@ -5,0 +6,2 @@\n+one\n+two\n`);
});
