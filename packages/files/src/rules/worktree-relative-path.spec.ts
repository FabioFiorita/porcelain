import { describe, expect, it } from 'vitest';
import { isWorktreeRelativePath } from './worktree-relative-path.ts';

describe('isWorktreeRelativePath', () => {
  it('accepts normalized paths inside the worktree', () => {
    expect(
      ['logo.svg', 'docs/images/logo.svg', '.github/icon.png', 'a..b/c'].map(
        isWorktreeRelativePath,
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
      ].map(isWorktreeRelativePath),
    ).toEqual([false, false, false, false, false, false, false]);
  });

  it('refuses Windows separators, drive letters and NUL', () => {
    expect(
      ['docs\\logo.png', 'C:logo.png', 'logo\0.png'].map(
        isWorktreeRelativePath,
      ),
    ).toEqual([false, false, false]);
  });

  it('refuses any segment naming the Git folder in any case', () => {
    expect(
      ['.git', '.git/config', 'sub/.GIT/HEAD'].map(isWorktreeRelativePath),
    ).toEqual([false, false, false]);
  });

  it('accepts 4096 characters and refuses one more', () => {
    expect(isWorktreeRelativePath('a'.repeat(4096))).toBe(true);
    expect(isWorktreeRelativePath('a'.repeat(4097))).toBe(false);
  });

  it('refuses text holding a lone surrogate', () => {
    expect(isWorktreeRelativePath('logo\uD800.png')).toBe(false);
    expect(isWorktreeRelativePath('logo😀.png')).toBe(true);
  });
});
