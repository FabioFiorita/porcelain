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

it('identifies a detached checkout by its folder', () => {
  expect(
    worktreeRow({
      ...entry,
      name: 'qa-531',
      branch: 'Detached HEAD',
      detached: true,
      path: '/code/porcelain-worktrees/qa-531',
    }).title,
  ).toBe('qa-531');
});

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
    changes: '—',
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
