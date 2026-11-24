import { expect, it } from 'vite-plus/test';
import { fileComparison } from './file-comparison';

const branch = [{ path: 'src/owner.ts' }];
const worktree = [{ path: 'notes.md' }];

it('opens a file on Branch when committed, on Uncommitted otherwise, and waits until the branch is read', () => {
  const read = { branch, branchFailed: false, worktree };
  expect(fileComparison(read, 'src/owner.ts')).toEqual({ kind: 'branch' });
  expect(fileComparison(read, 'notes.md')).toEqual({ kind: 'worktree' });
  expect(
    fileComparison({ ...read, branch: undefined }, 'notes.md'),
  ).toBeUndefined();
});

it('opens a local change on Uncommitted when the branch cannot be read, and leaves only unknown files unavailable', () => {
  const failed = { branch: undefined, branchFailed: true, worktree };
  expect(fileComparison(failed, 'notes.md')).toEqual({ kind: 'worktree' });
  expect(fileComparison(failed, 'src/owner.ts')).toBeUndefined();
});
