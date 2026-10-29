import { expect, it } from 'vitest';
import type { ReviewListEntry } from '@porcelain/client/reviews/rules';
import { worktreeRow } from './worktree-row.ts';

const entry: ReviewListEntry = {
  key: 'computer/project/review',
  environmentId: 'computer',
  environmentName: 'Private workstation',
  projectId: 'project',
  projectName: 'Porcelain',
  worktreeId: 'worktree',
  reviewId: 'review',
  branch: 'feat/pinned-files',
  detached: false,
  title: 'Pin files in large repositories',
  group: 'Needs you',
  closed: false,
  reviewed: 1,
  total: 4,
  badges: [],
  disabled: false,
};

it('shows an unreviewed branch once beside its project', () => {
  const row = worktreeRow(
    {
      ...entry,
      title: 'fix/flaky-history',
      branch: 'fix/flaky-history',
      group: 'No review',
      reviewId: undefined,
    },
    false,
  );
  expect(row).toEqual({
    kind: 'worktree',
    title: 'fix/flaky-history',
    project: 'Porcelain',
    location: undefined,
    status: 'none',
    accessibilityLabel: 'fix/flaky-history, Porcelain, No review',
  });
});

it('retains full long names, all reasons and selected/unavailable state without a computer name', () => {
  const title = 'A long review title '.repeat(12).trim();
  const row = worktreeRow(
    {
      ...entry,
      title,
      disabled: true,
      badges: [
        { label: 'Proof failed', variant: 'destructive' },
        { label: '2 not explained', variant: 'outline' },
        { label: 'Agent says hold', variant: 'secondary' },
      ],
    },
    true,
  );
  expect(row.kind).toBe('review');
  expect(row.project).toBe('Porcelain');
  expect(row.status).toBe('failed');
  expect(row.accessibilityLabel).toBe(
    `${title}, Porcelain, feat/pinned-files, Needs you, 1/4 decisions reviewed, Proof failed, 2 not explained, Agent says hold, current, unavailable`,
  );
});

it('keeps detached and zero-decision rows readable without absent metadata', () => {
  const row = worktreeRow(
    {
      ...entry,
      title: '/tmp/detached-worktree',
      branch: '',
      reviewed: 0,
      total: 0,
    },
    false,
  );
  expect(row.accessibilityLabel).toBe(
    '/tmp/detached-worktree, Porcelain, Needs you, 0/0 decisions reviewed',
  );
  expect(row.project).toBe('Porcelain');
  expect(row.kind === 'review' && row.branch).toBe('');
});

it.each(['qa-531', 'qa-532'])(
  'shows the parent folder of detached checkout %s and announces its full path',
  (name) => {
    const row = worktreeRow(
      {
        ...entry,
        title: name,
        branch: 'Detached HEAD',
        detached: true,
        path: `/home/dev/code/porcelain-worktrees/${name}`,
        group: 'No review',
        reviewId: undefined,
      },
      false,
    );
    expect(row.kind).toBe('worktree');
    expect(row.kind === 'worktree' && row.location).toBe(
      '/home/dev/code/porcelain-worktrees',
    );
    expect(row.title).toBe(name);
    expect(row.accessibilityLabel).toBe(
      `${name}, Porcelain, /home/dev/code/porcelain-worktrees/${name}, No review`,
    );
  },
);

it.each([
  ['Projects', 'none'],
  ['Needs you', 'needs-you'],
  ['Waiting on agent', 'waiting'],
  ['Ready to merge', 'ready'],
  ['No review', 'none'],
  ['Closed', 'closed'],
] as const)('draws one status for %s', (group, status) => {
  expect(worktreeRow({ ...entry, group }, false).status).toBe(status);
});
