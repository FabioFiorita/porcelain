import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { parseWorktreeList } from './parse-worktree-list.ts';

const HEAD = 'f4e8dd3408852fb71b1581394612bcf35e414dfc';

describe('parseWorktreeList', () => {
  it('reads the main checkout and linked, detached and locked worktrees, keeping spaces in paths', () => {
    expect(
      parseWorktreeList(fixture('worktrees/linked.txt').toString('utf8')),
    ).toEqual([
      { path: '/tmp/porcelain-fixtures/repo', branch: 'refs/heads/main' },
      { path: '/tmp/porcelain-fixtures/feature', branch: 'refs/heads/feature' },
      { path: '/tmp/porcelain-fixtures/my detached', branch: null },
    ]);
  });

  it('refuses a bare repository', () => {
    expect(() =>
      parseWorktreeList(fixture('worktrees/bare.txt').toString('utf8')),
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
