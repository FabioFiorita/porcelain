import { describe, expect, it } from 'vitest';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  hiddenSummary,
  visibleFileTreePaths,
} from './file-preferences.ts';

describe('hidden project paths', () => {
  it('hides a selected directory and its children without hiding a similarly named sibling', () => {
    const hidden = new Set(['src/private']);
    expect(hiddenPathFor('src/private/key.txt', hidden)).toBe('src/private');
    expect(hiddenPathFor('src/private-copy/key.txt', hidden)).toBeNull();
    expect(
      visibleFileTreePaths(
        ['src/private/key.txt', 'src/private-copy/key.txt'],
        hidden,
        false,
      ),
    ).toEqual(['src/private-copy/key.txt']);
    expect(visibleFileTreePaths(['src/private/key.txt'], hidden, true)).toEqual(
      ['src/private/key.txt'],
    );
  });

  it('removes a trailing directory separator before saving a preference', () => {
    expect(canonicalPreferencePath('src/private/')).toBe('src/private');
  });
});

it.each([
  [['docs', 'scripts', 'tests'], '3 hidden folders'],
  [['docs'], '1 hidden folder'],
  [['secrets.env', '.envrc'], '2 hidden files'],
  [['docs', 'secrets.env'], '2 hidden items'],
  [['not-loaded'], '1 hidden item'],
] as const)('summarises hidden %j as %s', (paths, summary) => {
  const kinds = new Map<string, string>([
    ['docs', 'directory'],
    ['scripts', 'directory'],
    ['tests', 'directory'],
    ['secrets.env', 'file'],
    ['.envrc', 'file'],
  ]);
  expect(hiddenSummary(new Set(paths), (path) => kinds.get(path))).toBe(
    summary,
  );
});
