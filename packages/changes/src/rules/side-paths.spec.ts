import { describe, expect, it } from 'vitest';
import { sidePaths } from './side-paths.ts';
import { modified, unmerged } from '../../spec/fakes/comparisons.ts';

describe('sidePaths', () => {
  it('reads untracked, conflicted and unstaged files from the worktree', () => {
    expect(
      sidePaths([
        { scope: 'untracked', path: 'notes.txt' },
        unmerged('clash.md'),
        modified('unstaged', 'README.md'),
      ]),
    ).toEqual({
      files: ['notes.txt', 'clash.md', 'README.md'],
      submodules: [],
    });
  });

  it('reads a changed submodule as a submodule head, not as a file', () => {
    expect(
      sidePaths([{ ...modified('unstaged', 'vendor/lib'), newMode: '160000' }]),
    ).toEqual({ files: [], submodules: ['vendor/lib'] });
  });

  it('reads nothing for staged changes and unstaged deletions', () => {
    expect(
      sidePaths([
        modified('staged', 'README.md', '1'.repeat(40)),
        {
          ...modified('unstaged', 'gone.md'),
          kind: 'deleted',
          newPath: undefined,
        },
      ]),
    ).toEqual({ files: [], submodules: [] });
  });

  it('reads a path once when it appears in several comparisons', () => {
    expect(
      sidePaths([
        modified('unstaged', 'README.md'),
        { scope: 'untracked', path: 'README.md' },
      ]),
    ).toEqual({ files: ['README.md'], submodules: [] });
  });
});
