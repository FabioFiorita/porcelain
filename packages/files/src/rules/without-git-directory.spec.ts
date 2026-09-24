import { describe, expect, it } from 'vitest';
import type { DirectoryEntry } from '@porcelain/files/models';
import { withoutGitDirectory } from './without-git-directory.ts';

describe('withoutGitDirectory', () => {
  it('drops the Git folder whatever its letter case', () => {
    expect(
      withoutGitDirectory([
        { name: '.git', kind: 'directory' },
        { name: '.GIT', kind: 'file' },
        { name: 'src', kind: 'directory' },
      ]),
    ).toEqual([{ name: 'src', kind: 'directory' }]);
  });

  it('keeps entries whose names only begin like the Git folder', () => {
    const entries: DirectoryEntry[] = [
      { name: '.github', kind: 'directory' },
      { name: '.gitignore', kind: 'file' },
      { name: 'x.git', kind: 'directory' },
    ];
    expect(withoutGitDirectory(entries)).toEqual(entries);
  });
});
