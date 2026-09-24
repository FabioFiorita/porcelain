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
  it('finds a commit that states no expected files missing them', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['README.md'] },
        {},
      ),
    ).toBe('missing');
  });

  it('finds an amend that states no expected files missing them', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'amend', message: 'Reword', paths: [] },
        {},
      ),
    ).toBe('missing');
  });

  it('agrees with expected files that are exactly the selection, in any order', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['a.md', 'b.md'] },
        { files: files('b.md', 'a.md') },
      ),
    ).toBe('agrees');
  });

  it('finds an expected file that is not selected mismatched', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Fix', paths: ['a.md'] },
        { files: files('a.md', 'b.md') },
      ),
    ).toBe('mismatched');
  });

  it('finds a selected path that is not expected mismatched', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'amend', message: 'Fix', paths: ['a.md', 'b.md'] },
        { files: files('a.md') },
      ),
    ).toBe('mismatched');
  });

  it('agrees with a merge commit whose expected files include more than the selection', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Merge', paths: ['a.md'] },
        { ...merging, files: files('a.md', 'b.md') },
      ),
    ).toBe('agrees');
  });

  it('finds a merge commit that selects a path it does not expect mismatched', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'commit', message: 'Merge', paths: ['c.md'] },
        { ...merging, files: files('a.md') },
      ),
    ).toBe('mismatched');
  });

  it('leaves actions other than commit and amend alone', () => {
    expect(
      commitExpectsSelectedFiles(
        { action: 'create-branch', branch: 'feature', switchTo: false },
        {},
      ),
    ).toBe('agrees');
  });
});
