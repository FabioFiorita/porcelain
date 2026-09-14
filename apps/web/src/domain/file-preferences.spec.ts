import { describe, expect, it } from 'vitest';
import {
  canonicalPreferencePath,
  hiddenPathFor,
  visibleFileTreePaths,
} from './file-preferences';

describe('file tree visibility', () => {
  it('hides a file directly and every descendant of a hidden folder', () => {
    const hidden = new Set(['README.md', 'generated']);

    expect(hiddenPathFor('README.md', hidden)).toBe('README.md');
    expect(hiddenPathFor('generated/client.ts', hidden)).toBe('generated');
    expect(hiddenPathFor('src/app.ts', hidden)).toBeNull();
    expect(
      visibleFileTreePaths(
        [
          'README.md',
          'generated/',
          'generated/client.ts',
          'src/',
          'src/app.ts',
        ],
        hidden,
        false,
      ),
    ).toEqual(['src/', 'src/app.ts']);
  });

  it('stores a directory in the canonical preference-path spelling', () => {
    expect(canonicalPreferencePath('generated/')).toBe('generated');
    expect(canonicalPreferencePath('README.md')).toBe('README.md');
  });

  it('retains hidden entries while the user is revealing them', () => {
    const paths = ['README.md', 'generated/', 'generated/client.ts'];

    expect(visibleFileTreePaths(paths, new Set(['generated']), true)).toBe(
      paths,
    );
  });
});
