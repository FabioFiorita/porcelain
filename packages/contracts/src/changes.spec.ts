import { expect, it } from 'vitest';
import { changeDiffsRequestSchema, changeLinesQuerySchema } from './changes.ts';

const selection = {
  scope: 'staged',
  oldPath: null,
  newPath: ':(glob)*\n😀.txt',
} as const;
const request = {
  expectedStatusToken: 'a'.repeat(64),
  expectedFiles: [{ path: 'README.md', fingerprint: 'b'.repeat(64) }],
  selections: [selection],
};

it('accepts literal relative Git paths and rejects traversal, lossy strings and extra fields', () => {
  expect(changeDiffsRequestSchema.parse(request)).toEqual(request);
  for (const newPath of [
    '',
    '/absolute',
    '../outside',
    'a/../outside',
    'a//b',
    'a\0b',
    '\ud800',
  ]) {
    expect(
      changeDiffsRequestSchema.safeParse({
        ...request,
        selections: [{ ...selection, newPath }],
      }).success,
    ).toBe(false);
  }
  expect(
    changeDiffsRequestSchema.safeParse({ ...request, extra: true }).success,
  ).toBe(false);
  expect(
    changeDiffsRequestSchema.safeParse({
      ...request,
      selections: [{ ...selection, newPath: null }],
    }).success,
  ).toBe(false);
  expect(
    changeDiffsRequestSchema.safeParse({
      ...request,
      selections: [{ ...selection, scope: 'unmerged' }],
    }).success,
  ).toBe(false);
});

/** A layer is a handful of files; a whole worktree is not a diff read. */
it('refuses an empty request and one larger than a layer', () => {
  expect(
    changeDiffsRequestSchema.safeParse({ ...request, selections: [] }).success,
  ).toBe(false);
  expect(
    changeDiffsRequestSchema.safeParse({
      ...request,
      selections: Array.from({ length: 201 }, () => selection),
    }).success,
  ).toBe(false);
  // The fingerprints the caller holds are not optional: without them the
  // observation token alone would decide, and it cannot see a file's bytes.
  const { expectedFiles: _omitted, ...without } = request;
  expect(changeDiffsRequestSchema.safeParse(without).success).toBe(false);
  expect(
    changeDiffsRequestSchema.safeParse({ ...request, expectedFiles: [] })
      .success,
  ).toBe(false);
});

it('coerces a line range from the query string and names where it is read from', () => {
  expect(
    changeLinesQuerySchema.parse({
      path: 'src/app.ts',
      from: '10',
      to: '20',
      at: 'head',
    }),
  ).toEqual({ path: 'src/app.ts', from: 10, to: 20, at: 'head' });
  for (const query of [
    { path: 'src/app.ts', from: '0', to: '20', at: 'head' },
    { path: '../outside', from: '1', to: '20', at: 'head' },
    // The working file is never a stand-in for a revision.
    { path: 'src/app.ts', from: '1', to: '20', at: 'index' },
  ])
    expect(changeLinesQuerySchema.safeParse(query).success).toBe(false);
});
