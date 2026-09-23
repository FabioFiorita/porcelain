import {
  ExpectedFilesMismatchError,
  MissingExpectedFilesError,
} from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import { commitExpectsSelectedFiles } from './commit-expects-selected-files.ts';

const fingerprint = 'a'.repeat(64);
const merging = {
  inProgress: 'merge' as const,
  mergeHeadOid: 'b'.repeat(40),
};
const files = (...paths: string[]) =>
  paths.map((path) => ({ path, fingerprint }));

describe('commitExpectsSelectedFiles', () => {
  it('refuses a commit that states no expected files', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['README.md'] },
        {},
      ),
    ).toThrow(MissingExpectedFilesError);
  });

  it('refuses an amend that states no expected files', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'amend', message: 'Reword', paths: [] },
        {},
      ),
    ).toThrow(MissingExpectedFilesError);
  });

  it('accepts expected files that are exactly the selection, in any order', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['a.md', 'b.md'] },
        { files: files('b.md', 'a.md') },
      ),
    ).not.toThrow();
  });

  it('refuses an expected file that is not selected', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['a.md'] },
        { files: files('a.md', 'b.md') },
      ),
    ).toThrow(ExpectedFilesMismatchError);
  });

  it('refuses a selected path that is not expected', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'amend', message: 'Fix', paths: ['a.md', 'b.md'] },
        { files: files('a.md') },
      ),
    ).toThrow(ExpectedFilesMismatchError);
  });

  it('accepts a merge commit whose expected files include more than the selection', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Merge', paths: ['a.md'] },
        { ...merging, files: files('a.md', 'b.md') },
      ),
    ).not.toThrow();
  });

  it('refuses a merge commit that selects a path it does not expect', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Merge', paths: ['c.md'] },
        { ...merging, files: files('a.md') },
      ),
    ).toThrow(ExpectedFilesMismatchError);
  });

  it('leaves actions other than commit and amend alone', () => {
    expect(() =>
      commitExpectsSelectedFiles(
        { action: 'create-branch', branch: 'feature', switchTo: false },
        {},
      ),
    ).not.toThrow();
  });
});
