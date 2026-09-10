import { expect, it } from 'vitest';
import { highlightedDiffLines } from './diff-highlight';

it('highlights source syntax independently on both sides and labels the hunk without raw patch syntax', () => {
  const rows = highlightedDiffLines(
    '@@ -1 +1,4 @@\n-export type Context = string;\n+export type ReviewScope = {\n+  projectId: string;\n+  worktreeId: string;\n+};',
    'ts',
  );
  expect(rows[0]?.tokens[0]?.value).toBe('Lines 1–4 · previously line 1');
  expect(rows[1]).toMatchObject({
    kind: 'deleted',
    oldNumber: 1,
    newNumber: null,
  });
  expect(rows[2]).toMatchObject({
    kind: 'inserted',
    oldNumber: null,
    newNumber: 1,
  });
  expect(
    rows[2]?.tokens.some(
      (token) =>
        token.className === 'keyword' && token.value.includes('export'),
    ),
  ).toBe(true);
  expect(rows[5]?.newNumber).toBe(4);
});
it('keeps multiline syntax separate across old and new sides', () => {
  const rows = highlightedDiffLines(
    '@@ -1,2 +1,2 @@\n-/* old comment\n+const first = 1;\n shared\n@@ -10 +10 @@\n-old\n+const second = 2;',
    'ts',
  );
  const shared = rows.find((row) => row.kind === 'context');
  expect(shared?.tokens.some((token) => token.className === 'comment')).toBe(
    false,
  );
  expect(
    rows.at(-1)?.tokens.some((token) => token.className === 'keyword'),
  ).toBe(true);
  expect(rows.at(-1)?.newNumber).toBe(10);
});
it('distinguishes header-like source from metadata and handles empty sides and missing newlines', () => {
  const rows = highlightedDiffLines(
    '@@ -0,0 +1,2 @@\n+++counter;\n+last\n\\ No newline at end of file\n@@ -4,1 +3,0 @@\n---counter;',
    'ts',
  );
  expect(rows[0]?.tokens[0]?.value).toBe('Added lines 1–2');
  expect(rows[1]?.tokens.map((token) => token.value).join('')).toBe(
    '++counter;',
  );
  expect(
    rows
      .at(-1)
      ?.tokens.map((token) => token.value)
      .join(''),
  ).toBe('--counter;');
  expect(rows.at(-1)?.oldNumber).toBe(4);
});

it('omits redundant file headers while retaining readable line ranges', () => {
  const rows = highlightedDiffLines(
    'diff --git a/a.ts b/a.ts\nindex abc..def 100644\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new',
    'ts',
  );
  expect(
    rows.map((row) => row.tokens.map((token) => token.value).join('')),
  ).toEqual(['Line 1 · previously line 1', 'old', 'new']);
});

it('resets unknown syntax context between separated hunks', () => {
  const rows = highlightedDiffLines(
    '@@ -1 +1 @@\n-old\n+/* comment\n@@ -10 +10 @@\n-old\n+const resumed = 1;',
    'ts',
  );
  expect(
    rows.at(-1)?.tokens.some((token) => token.className === 'keyword'),
  ).toBe(true);
});
it('preserves the final line of a large hunk within the server patch limit', () => {
  const count = 150_000;
  const rows = highlightedDiffLines(
    `@@ -0,0 +1,${count} @@\n${'+x\n'.repeat(count)}`,
    'text',
  );
  expect(rows).toHaveLength(count + 1);
  expect(rows.at(-1)?.newNumber).toBe(count);
  expect(
    rows
      .at(-1)
      ?.tokens.map((token) => token.value)
      .join(''),
  ).toBe('x');
});
