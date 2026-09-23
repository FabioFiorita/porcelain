import { EmptyCommitSelectionError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { commitSelectsPaths } from './commit-selects-paths.ts';

describe('commitSelectsPaths', () => {
  it('refuses a commit that selects no path', () => {
    expect(() =>
      commitSelectsPaths({ action: 'commit', message: 'Fix', paths: [] }, {}),
    ).toThrow(EmptyCommitSelectionError);
  });

  it('accepts a merge commit that selects no path', () => {
    expect(() =>
      commitSelectsPaths(
        { action: 'commit', message: 'Merge', paths: [] },
        { inProgress: 'merge', mergeHeadOid: 'b'.repeat(40) },
      ),
    ).not.toThrow();
  });

  it('accepts an amend that only rewrites the message', () => {
    expect(() =>
      commitSelectsPaths({ action: 'amend', message: 'Reword', paths: [] }, {}),
    ).not.toThrow();
  });

  it('accepts a commit that selects a path', () => {
    expect(() =>
      commitSelectsPaths(
        { action: 'commit', message: 'Fix', paths: ['README.md'] },
        {},
      ),
    ).not.toThrow();
  });
});
