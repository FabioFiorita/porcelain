import { expect, it } from 'vitest';
import { gitDiffRequestSchema } from './git-diff.ts';

it('accepts literal relative Git paths and rejects traversal, lossy strings and extra fields', () => {
  const request = {
    expectedStatusToken: 'a'.repeat(64),
    change: { scope: 'staged', oldPath: null, newPath: ':(glob)*\n😀.txt' },
  };
  expect(gitDiffRequestSchema.parse(request)).toEqual(request);
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
      gitDiffRequestSchema.safeParse({
        ...request,
        change: { ...request.change, newPath },
      }).success,
    ).toBe(false);
  }
  expect(
    gitDiffRequestSchema.safeParse({ ...request, extra: true }).success,
  ).toBe(false);
  expect(
    gitDiffRequestSchema.safeParse({
      ...request,
      change: { ...request.change, newPath: null },
    }).success,
  ).toBe(false);
  expect(
    gitDiffRequestSchema.safeParse({
      ...request,
      change: { ...request.change, scope: 'unmerged' },
    }).success,
  ).toBe(false);
});
