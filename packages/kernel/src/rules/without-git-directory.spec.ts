import { describe, expect, it } from 'vitest';
import { withoutGitDirectory } from './without-git-directory.ts';

describe('withoutGitDirectory', () => {
  it('drops the Git folder whatever its letter case', () => {
    expect(
      withoutGitDirectory([
        { name: '.git', kind: 'directory' },
        { name: '.GIT', kind: 'file' },
        { name: '.Git', kind: 'directory' },
        { name: 'src', kind: 'directory' },
      ]),
    ).toEqual([{ name: 'src', kind: 'directory' }]);
  });

  it('keeps entries whose names only begin like the Git folder', () => {
    const entries = [
      { name: '.github' },
      { name: '.gitignore' },
      { name: 'x.git' },
      { name: '.git ' },
    ];
    expect(withoutGitDirectory(entries)).toEqual(entries);
  });

  it('answers nothing for no entries', () => {
    expect(withoutGitDirectory([])).toEqual([]);
  });
});
