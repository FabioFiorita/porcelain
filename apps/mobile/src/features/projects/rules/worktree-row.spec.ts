import { expect, it } from 'vitest';
import type { NavigatorEntry } from '@porcelain/client/projects/rules';
import { worktreeRow } from './worktree-row';

const entry: NavigatorEntry = {
  key: 'computer/project/worktree',
  kind: 'worktree',
  environmentId: 'computer',
  environmentName: 'Private workstation',
  projectId: 'project',
  projectName: 'Porcelain',
  worktreeId: 'worktree',
  path: '/code/porcelain',
  name: 'feat/pinned-files',
  branch: 'feat/pinned-files',
  main: false,
  detached: false,
  available: true,
  review: { state: 'none' },
  changes: { state: 'available', count: 0 },
};

it('keeps full branch names without clean-state filler', () => {
  const branch = 'a-long-branch-name-'.repeat(12);
  expect(worktreeRow({ ...entry, branch })).toMatchObject({
    title: branch,
    review: '',
    changes: '',
  });
});

it.each(['qa-531', 'qa-532'])(
  'identifies detached checkout %s by its folder',
  (name) => {
    expect(
      worktreeRow({
        ...entry,
        name,
        branch: 'Detached HEAD',
        detached: true,
        path: `/code/porcelain-worktrees/${name}`,
      }).title,
    ).toBe(name);
  },
);

it('keeps pending and failed reads distinct from a clean checkout without a review', () => {
  expect(
    worktreeRow({
      ...entry,
      changes: { state: 'loading' },
      review: { state: 'loading' },
    }),
  ).toMatchObject({ review: 'Reading review…', changes: 'Reading changes…' });
  expect(
    worktreeRow({
      ...entry,
      changes: { state: 'unavailable' },
      review: { state: 'unavailable' },
    }),
  ).toMatchObject({
    review: 'Review unavailable',
    changes: 'Changes unavailable',
  });
});

it('shows a quiet changed-file count', () => {
  expect(
    worktreeRow({
      ...entry,
      changes: {
        state: 'available',
        count: 2,
      },
    }).changes,
  ).toBe('2 files changed');
});
