import { describe, expect, it } from 'vitest';
import { parseWorktreeList } from './parse-worktree-list.ts';

const HEAD = '89a62767b7c1cfff9b57b06d729f07c2fb4b0c90';

describe('parseWorktreeList', () => {
  it('reads the main checkout and linked, detached and locked worktrees', () => {
    const output =
      `worktree /work/repo\0HEAD ${HEAD}\0branch refs/heads/main\0\0` +
      `worktree /work/feature\0HEAD ${HEAD}\0branch refs/heads/feature\0\0` +
      `worktree /work/detached\0HEAD ${HEAD}\0detached\0locked on usb\0\0`;
    expect(parseWorktreeList(output)).toEqual([
      { path: '/work/repo', branch: 'refs/heads/main' },
      { path: '/work/feature', branch: 'refs/heads/feature' },
      { path: '/work/detached', branch: null },
    ]);
  });

  it('keeps spaces in a worktree path', () => {
    expect(
      parseWorktreeList(`worktree /work/my repo\0HEAD ${HEAD}\0detached\0\0`),
    ).toEqual([{ path: '/work/my repo', branch: null }]);
  });

  it('refuses a bare repository', () => {
    expect(() =>
      parseWorktreeList('worktree /work/bare.git\0bare\0\0'),
    ).toThrow('Bare repositories are not supported');
  });

  it('refuses a record without a path and an empty inventory', () => {
    expect(() => parseWorktreeList(`HEAD ${HEAD}\0detached\0\0`)).toThrow(
      'Git worktree inventory is invalid',
    );
    expect(() => parseWorktreeList('')).toThrow(
      'Git worktree inventory is invalid',
    );
  });
});
