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
  ).toMatchObject({ changes: 'Reading changes…' });
  expect(
    worktreeRow({
      ...entry,
      changes: { state: 'unavailable' },
      review: { state: 'unavailable' },
    }),
  ).toMatchObject({
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

it('leads with the walkthrough or pull request title and keeps the branch as small text', () => {
  expect(
    worktreeRow({
      ...entry,
      displayTitle: 'Teach the sample to explain itself',
    }),
  ).toMatchObject({
    title: 'Teach the sample to explain itself',
    branch: 'feat/pinned-files',
  });
  expect(worktreeRow(entry)).toMatchObject({
    title: 'feat/pinned-files',
    branch: '',
  });
});

it('announces each detached checkout by its path and preserves main-checkout identity', () => {
  const detached = {
    ...entry,
    detached: true,
    name: 'qa',
    branch: 'Detached HEAD',
  };
  expect(
    worktreeRow({ ...detached, path: '/code/one/qa' }).accessibilityLabel,
  ).toBe('qa, Detached HEAD, /code/one/qa, Porcelain, Private workstation');
  expect(
    worktreeRow({ ...detached, path: '/code/two/qa' }).accessibilityLabel,
  ).toBe('qa, Detached HEAD, /code/two/qa, Porcelain, Private workstation');
  expect(worktreeRow({ ...entry, main: true }).accessibilityLabel).toBe(
    'feat/pinned-files, Main worktree, Porcelain, Private workstation',
  );
});
