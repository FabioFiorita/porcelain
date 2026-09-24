import { describe, expect, it } from 'vitest';
import { isWorktreeRelativePath } from './worktree-relative-path.ts';

const relative = (path: string) => isWorktreeRelativePath(path, 4096);

describe('isWorktreeRelativePath', () => {
  it('accepts normalized paths inside the worktree', () => {
    expect(
      ['logo.svg', 'docs/images/logo.svg', '.github/icon.png', 'a..b/c'].map(
        relative,
      ),
    ).toEqual([true, true, true, true]);
  });

  it('refuses paths that escape or are not normalized', () => {
    expect(
      [
        '',
        '/etc/passwd',
        '../outside.png',
        'docs/../x',
        './x',
        'a//b',
        'a/',
      ].map(relative),
    ).toEqual([false, false, false, false, false, false, false]);
  });

  it('refuses Windows separators, drive letters and NUL', () => {
    expect(
      ['docs\\logo.png', 'C:logo.png', 'logo\0.png'].map(relative),
    ).toEqual([false, false, false]);
  });

  it('refuses any segment naming the Git folder in any case', () => {
    expect(['.git', '.git/config', 'sub/.GIT/HEAD'].map(relative)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('accepts a path at the length limit and refuses one character more', () => {
    expect(isWorktreeRelativePath('a'.repeat(10), 10)).toBe(true);
    expect(isWorktreeRelativePath('a'.repeat(11), 10)).toBe(false);
  });

  it('refuses text holding a lone surrogate', () => {
    expect(relative('logo\uD800.png')).toBe(false);
    expect(relative('logo😀.png')).toBe(true);
  });
});
