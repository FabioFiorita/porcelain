import { expect, it } from 'vitest';
import {
  branchChangeMarks,
  changeStatus,
  changeStatusMarks,
  worktreeChangeMarks,
} from './change-marks.ts';

const ordinary = (
  scope: 'staged' | 'unstaged',
  kind: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed',
) => ({
  scope,
  kind,
  oldPath: 'before.ts',
  newPath: 'after.ts',
  oldMode: '100644',
  newMode: '100644',
  oldOid: undefined,
  newOid: undefined,
  supported: true,
});

it.each([
  [ordinary('unstaged', 'added'), 'A', 'Added'],
  [ordinary('staged', 'modified'), 'M', 'Modified'],
  [ordinary('unstaged', 'deleted'), 'D', 'Deleted'],
  [ordinary('staged', 'renamed'), 'R', 'Renamed'],
  [ordinary('unstaged', 'type-changed'), 'M', 'Modified'],
  [{ scope: 'untracked' as const, path: 'apps/web/new.ts' }, 'U', 'Untracked'],
  [
    {
      scope: 'unmerged' as const,
      path: 'apps/web/new.ts',
      conflict: 'both-modified' as const,
    },
    'M',
    'Modified',
  ],
])('marks a worktree change %j as %s', (change, letter, label) => {
  const marks = worktreeChangeMarks([
    { path: 'apps/web/new.ts', comparisons: [change] },
  ]);
  const status = marks.files.get('apps/web/new.ts');
  expect(status && changeStatusMarks[status]).toEqual({ letter, label });
});

it.each([
  [ordinary('staged', 'renamed'), 'renamed'],
  [ordinary('unstaged', 'type-changed'), 'modified'],
  [{ scope: 'untracked' as const, path: 'a.ts' }, 'untracked'],
] as const)('reads the change status of %j as %s', (change, status) => {
  expect(changeStatus(change)).toBe(status);
});

it('marks no folder for a file that only was deleted', () => {
  const marks = worktreeChangeMarks([
    { path: 'gone/old.ts', comparisons: [ordinary('staged', 'deleted')] },
  ]);
  expect([...marks.files]).toEqual([['gone/old.ts', 'deleted']]);
  expect(marks.folders.size).toBe(0);
});

it('keeps the first comparison of a file staged and changed again', () => {
  const marks = worktreeChangeMarks([
    {
      path: 'src/app.ts',
      comparisons: [
        ordinary('staged', 'added'),
        ordinary('unstaged', 'modified'),
      ],
    },
  ]);
  expect([...marks.files]).toEqual([['src/app.ts', 'added']]);
});

it.each([
  {
    name: 'a staged deletion recreated as an untracked file',
    comparisons: [
      ordinary('staged', 'deleted'),
      { scope: 'untracked' as const, path: 'src/app.ts' },
    ],
    status: 'deleted',
    folders: ['src'],
  },
  {
    name: 'a staged addition deleted from the worktree',
    comparisons: [ordinary('staged', 'added'), ordinary('unstaged', 'deleted')],
    status: 'added',
    folders: [],
  },
])(
  'marks folders from the current state of $name',
  ({ comparisons, status, folders }) => {
    const marks = worktreeChangeMarks([{ path: 'src/app.ts', comparisons }]);
    expect([...marks.files]).toEqual([['src/app.ts', status]]);
    expect([...marks.folders]).toEqual(folders);
  },
);

it('marks every folder above a changed file and no other folder', () => {
  const marks = worktreeChangeMarks([
    {
      path: 'apps/web/src/app.ts',
      comparisons: [ordinary('unstaged', 'modified')],
    },
    { path: 'README.md', comparisons: [ordinary('unstaged', 'modified')] },
  ]);
  expect([...marks.folders].sort()).toEqual([
    'apps',
    'apps/web',
    'apps/web/src',
  ]);
});

it.each([
  ['added', 'added'],
  ['deleted', 'deleted'],
  ['modified', 'modified'],
  ['renamed', 'renamed'],
  ['type-changed', 'modified'],
] as const)('marks a branch file %s as %s', (status, expected) => {
  const marks = branchChangeMarks([
    {
      path: 'packages/a/b.ts',
      oldPath: undefined,
      newPath: undefined,
      status,
      oldMode: '100644',
      newMode: '100644',
      fingerprint: 'f'.repeat(64),
    },
  ]);
  expect([...marks.files]).toEqual([['packages/a/b.ts', expected]]);
  expect([...marks.folders]).toEqual(
    expected === 'deleted' ? [] : ['packages', 'packages/a'],
  );
});
