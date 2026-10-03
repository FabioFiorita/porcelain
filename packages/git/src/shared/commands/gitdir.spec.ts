import { describe, expect, it } from 'vitest';
import { parseGitdirFile } from './gitdir.ts';

describe('parseGitdirFile', () => {
  it('reads the pointer Git writes into a linked worktree', () => {
    expect(parseGitdirFile('gitdir: /work/repo/.git/worktrees/feature\n')).toBe(
      '/work/repo/.git/worktrees/feature',
    );
  });

  it('keeps a relative pointer for the caller to resolve', () => {
    expect(parseGitdirFile('gitdir: ../repo/.git/worktrees/feature\r\n')).toBe(
      '../repo/.git/worktrees/feature',
    );
  });

  it('refuses a file that is not a gitdir pointer', () => {
    expect([
      parseGitdirFile(''),
      parseGitdirFile('gitdir:   \n'),
      parseGitdirFile('ref: refs/heads/main\n'),
      parseGitdirFile('gitdir: /a\n/b\n'),
      parseGitdirFile('gitdir: /a\0b'),
    ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});
