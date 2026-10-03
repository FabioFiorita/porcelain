import { describe, expect, it } from 'vitest';
import {
  canonicalPreferencePath,
  hiddenPathFor,
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
