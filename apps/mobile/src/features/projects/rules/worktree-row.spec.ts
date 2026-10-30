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

it('shows a branch once with clean checkout and no-review state', () => {
  expect(worktreeRow(entry)).toEqual({
    title: 'feat/pinned-files',
    subtitle: 'Working tree clean',
    detail: 'No review',
  });
});

it('keeps full branch names and unknown progress distinct from zero decisions', () => {
  const branch = 'a-long-branch-name-'.repeat(12);
  const row = {
    ...entry,
    branch,
    changes: { state: 'loading' as const },
    review: {
      state: 'available' as const,
      reviewId: 'review',
      closed: false,
      archived: false,
      pullRequestNumber: 42,
      progress: undefined,
    },
  };
  expect(worktreeRow(row)).toEqual({
    title: branch,
    subtitle: 'Reading changes…',
    detail: 'Review · reading progress…',
  });
  expect(
    worktreeRow({
      ...row,
      review: { ...row.review, progress: { reviewed: 0, total: 0 } },
    }).detail,
  ).toBe('Review · 0/0 decisions');
});

it.each(['qa-531', 'qa-532'])(
  'shows detached checkout %s by folder with its parent path',
  (name) => {
    expect(
      worktreeRow({
        ...entry,
        name,
        branch: 'Detached HEAD',
        detached: true,
        path: `/code/porcelain-worktrees/${name}`,
      }),
    ).toEqual({
      title: name,
      subtitle:
        'Detached HEAD · /code/porcelain-worktrees · Working tree clean',
      detail: 'No review',
    });
  },
);

it('labels the main checkout and preserves failures instead of implying clean or no review', () => {
  expect(
    worktreeRow({
      ...entry,
      main: true,
      changes: { state: 'unavailable' },
      review: { state: 'unavailable' },
    }),
  ).toEqual({
    title: 'feat/pinned-files',
    subtitle: 'Main worktree · Working tree unavailable',
    detail: 'Review unavailable',
  });
});
