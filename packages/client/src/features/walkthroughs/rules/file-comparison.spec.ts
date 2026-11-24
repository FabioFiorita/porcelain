import { expect, it } from 'vite-plus/test';
import { fileComparison, fileOpening } from './file-comparison.ts';

const branch = [
  { path: 'src/owner.ts', status: 'modified' },
  { path: 'src/old.ts', status: 'deleted' },
  { path: 'src/draft.ts', status: 'added' },
];
const worktree = [
  { path: 'notes.md', comparisons: [{ kind: 'modified' }] },
  { path: 'src/draft.ts', comparisons: [{ kind: 'deleted' }] },
];
const read = { branch, branchFailed: false, worktree };

it('opens a file on Branch when committed, on Uncommitted otherwise, and waits until the branch is read', () => {
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

it('opens a deletion where it happened: a local deletion on Uncommitted, a committed one on Branch', () => {
  expect(fileComparison(read, 'src/draft.ts')).toEqual({ kind: 'worktree' });
  expect(fileComparison(read, 'src/old.ts')).toEqual({ kind: 'branch' });
  expect(fileOpening(read, 'src/draft.ts')).toEqual({ kind: 'worktree' });
  expect(fileOpening(read, 'src/old.ts')).toEqual({ kind: 'branch' });
  expect(fileOpening(read, 'src/owner.ts')).toEqual({ kind: 'file' });
  expect(fileOpening(read, 'notes.md')).toEqual({ kind: 'file' });
});

it('opens a cited file only once the branch says whether it was deleted', () => {
  expect(
    fileOpening({ ...read, branch: undefined }, 'src/old.ts'),
  ).toBeUndefined();
  expect(
    fileOpening(
      { ...read, branch: undefined, branchFailed: true },
      'src/old.ts',
    ),
  ).toEqual({ kind: 'file' });
  expect(fileOpening({ ...read, branch: undefined }, 'src/draft.ts')).toEqual({
    kind: 'worktree',
  });
});
