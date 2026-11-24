import { expect, it } from 'vite-plus/test';
import { fileComparison } from './file-comparison';

it('opens a cited file on Branch when committed, on Uncommitted otherwise, and waits until the branch is read', () => {
  const branch = [{ path: 'src/owner.ts' }];
  expect(fileComparison(branch, 'src/owner.ts')).toEqual({ kind: 'branch' });
  expect(fileComparison(branch, 'notes.md')).toEqual({ kind: 'worktree' });
  expect(fileComparison(undefined, 'src/owner.ts')).toBeUndefined();
});
