import { describe, expect, it } from 'vitest';
import { gitActionTarget } from './git-action-target.ts';

const readme = { path: 'README.md', fingerprint: 'a'.repeat(64) };

describe('gitActionTarget', () => {
  it('leaves an action that expects no files unchecked', () => {
    expect(
      gitActionTarget({ action: 'switch-branch', branch: 'main' }, {}),
    ).toEqual({ kind: 'unchecked' });
  });

  it('checks only the expected files of a commit', () => {
    expect(
      gitActionTarget(
        { action: 'commit', message: 'Fix', paths: ['README.md'] },
        { files: [readme] },
      ),
    ).toEqual({ kind: 'checked', paths: ['README.md'] });
  });

  it('checks the whole change list before a stash', () => {
    expect(
      gitActionTarget(
        { action: 'stash-create', message: 'Park', includeUntracked: true },
        { files: [readme] },
      ),
    ).toEqual({ kind: 'checked', paths: undefined });
  });

  it('checks the whole change list before a merge commit', () => {
    expect(
      gitActionTarget(
        { action: 'commit', message: 'Merge', paths: [] },
        { inProgress: 'merge', mergeHeadOid: 'b'.repeat(40), files: [readme] },
      ),
    ).toEqual({ kind: 'checked', paths: undefined });
  });
});
