import { expect, it } from 'vite-plus/test';
import { fileComparison, fileOpening } from './file-comparison.ts';

const change = (
  scope: 'staged' | 'unstaged',
  kind: 'modified' | 'deleted',
  path: string,
) =>
  ({
    scope,
    kind,
    oldPath: path,
    newPath: kind === 'deleted' ? undefined : path,
    oldMode: '100644',
    newMode: kind === 'deleted' ? '000000' : '100644',
    oldOid: undefined,
    newOid: undefined,
    supported: true,
  }) as const;

const branch = [
  { path: 'src/owner.ts', status: 'modified' },
  { path: 'src/old.ts', status: 'deleted' },
  { path: 'src/draft.ts', status: 'added' },
];
const draftDeletion = change('unstaged', 'deleted', 'src/draft.ts');
const conflict = {
  scope: 'unmerged',
  path: 'src/conflicted.ts',
  conflict: 'both-modified',
} as const;
const worktree = [
  {
    path: 'notes.md',
    comparisons: [change('unstaged', 'modified', 'notes.md')],
  },
  {
    path: 'src/draft.ts',
    comparisons: [change('staged', 'modified', 'src/draft.ts'), draftDeletion],
  },
  {
    path: 'scratch.md',
    comparisons: [{ scope: 'untracked', path: 'scratch.md' }],
  },
  {
    path: 'src/conflicted.ts',
    comparisons: [conflict],
  },
] as const;
const read = { branch, branchFailed: false, worktree };

it('opens a file on Branch when committed, on Uncommitted otherwise, and waits for the branch only for files the working tree does not list', () => {
  expect(fileComparison(read, 'src/owner.ts')).toEqual({ kind: 'branch' });
  expect(fileComparison(read, 'notes.md')).toEqual({ kind: 'worktree' });
  const pending = { ...read, branch: undefined };
  expect(fileComparison(pending, 'notes.md')).toEqual({ kind: 'worktree' });
  expect(fileComparison(pending, 'scratch.md')).toEqual({ kind: 'worktree' });
  expect(fileComparison(pending, 'src/owner.ts')).toBeUndefined();
});

it.each([
  { branchRead: 'read', state: read },
  { branchRead: 'still loading', state: { ...read, branch: undefined } },
  {
    branchRead: 'failed',
    state: { ...read, branch: undefined, branchFailed: true },
  },
])(
  'opens a conflicted file on its conflict, never as a live file, when the branch is $branchRead',
  ({ state }) => {
    expect(fileOpening(state, 'src/conflicted.ts')).toEqual({
      kind: 'worktree',
      change: conflict,
    });
    expect(fileComparison(state, 'src/conflicted.ts')).toEqual({
      kind: 'worktree',
      change: conflict,
    });
  },
);

it('opens a local change on Uncommitted when the branch cannot be read, and leaves only unknown files unavailable', () => {
  const failed = { branch: undefined, branchFailed: true, worktree };
  expect(fileComparison(failed, 'notes.md')).toEqual({ kind: 'worktree' });
  expect(fileComparison(failed, 'src/owner.ts')).toBeUndefined();
});

it('opens a deletion on the comparison that holds it: the local one on Uncommitted, a committed one on Branch', () => {
  expect(fileComparison(read, 'src/draft.ts')).toEqual({
    kind: 'worktree',
    change: draftDeletion,
  });
  expect(fileOpening(read, 'src/draft.ts')).toEqual({
    kind: 'worktree',
    change: draftDeletion,
  });
  expect(fileComparison(read, 'src/old.ts')).toEqual({ kind: 'branch' });
  expect(fileOpening(read, 'src/old.ts')).toEqual({ kind: 'branch' });
  expect(fileOpening(read, 'src/owner.ts')).toEqual({ kind: 'file' });
  expect(fileOpening(read, 'notes.md')).toEqual({ kind: 'file' });
});

it('waits for the branch only for files the working tree does not already know', () => {
  const pending = { ...read, branch: undefined };
  expect(fileOpening(pending, 'scratch.md')).toEqual({ kind: 'file' });
  expect(fileOpening(pending, 'notes.md')).toEqual({ kind: 'file' });
  expect(fileOpening(pending, 'src/old.ts')).toBeUndefined();
  expect(fileOpening({ ...pending, branchFailed: true }, 'src/old.ts')).toEqual(
    { kind: 'file' },
  );
});
