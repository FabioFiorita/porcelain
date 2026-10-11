import { expect, test } from 'vitest';
import { fileTreeExpansion } from './file-tree.ts';

const directory = (path: string) => ({ path, kind: 'directory' as const });
const file = (path: string) => ({ path, kind: 'file' as const });

test('a new single child stays closed when its parent closed before loading', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b')],
      new Set(),
      new Set(['a']),
    ),
  ).toEqual([]);
});

test('two children prevent continuation, including a file sibling', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), directory('a/c')],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a']);
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), file('a/sibling.txt')],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a']);
});

test('a three-level single-child chain continues in parent order', () => {
  expect(
    fileTreeExpansion(
      [
        directory('a/b/c'),
        file('a/b/c/deep.txt'),
        directory('a/b'),
        directory('a'),
      ],
      new Set(['a']),
      new Set(['a']),
    ),
  ).toEqual(['a', 'a/b', 'a/b/c']);
});

test('a known folder closed by the user stays closed on rebuild', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('a/b'), file('a/b/file.txt')],
      new Set(['a']),
      new Set(['a', 'a/b']),
    ),
  ).toEqual(['a']);
});

test('deleting y after b closes never reopens b above its still-open child x', () => {
  expect(
    fileTreeExpansion(
      [
        directory('a'),
        directory('a/b'),
        directory('a/b/x'),
        file('a/b/x/file.txt'),
      ],
      new Set(['a', 'a/b/x']),
      new Set(['a', 'a/b', 'a/b/x', 'a/b/y']),
    ),
  ).toEqual(['a']);
});

test('new root folders stay closed and removed folders lose expansion', () => {
  expect(
    fileTreeExpansion(
      [directory('a'), directory('new')],
      new Set(['a', 'removed']),
      new Set(['a', 'removed']),
    ),
  ).toEqual(['a']);
});
