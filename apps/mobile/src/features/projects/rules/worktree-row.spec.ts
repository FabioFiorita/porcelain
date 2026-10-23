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
  title: 'Pin files in large repositories',
  group: 'Needs you',
  closed: false,
  reviewed: 1,
  total: 4,
  badges: [],
  disabled: false,
};

it.each([
  ['Projects', 'folder'],
  ['Needs you', 'review'],
  ['Waiting on agent', 'history'],
  ['Ready to merge', 'check'],
  ['No review', 'review'],
  ['Closed', 'closed'],
] as const)(
  'uses one status symbol for %s without an information affordance',
  (group, icon) => {
    const row = worktreeRow(
      {
        ...entry,
        group,
        reviewId:
          group === 'Projects' || group === 'No review' ? undefined : 'review',
        closed: group === 'Closed',
      },
      false,
      false,
    );
    expect(row.icon).toBe(icon);
    expect(row.accessibilityLabel).toContain(group);
    expect(row.accessibilityLabel).not.toContain('Private workstation');
  },
);

it.each([
  ['Proof failed', 'destructive'],
  ['2 not explained', 'outline'],
  ['Agent says hold', 'secondary'],
  ['Recommends merge', 'secondary'],
  ['Agent replied', 'default'],
  ['Waiting for a commit', 'secondary'],
  ['Archived', 'secondary'],
  ['PR merged', 'secondary'],
  ['PR closed', 'secondary'],
] as const)('announces the full reason %s', (label, variant) => {
  const row = worktreeRow(
    { ...entry, badges: [{ label, variant }] },
    false,
    false,
  );
  expect(row.accessibilityLabel).toContain(label);
  expect(row.accessibilityLabel).toContain('1/4 decisions reviewed');
  expect(row.icon).toBe(label === 'Proof failed' ? 'warning' : 'review');
});

it.each([false, true])(
  'does not repeat an unreviewed branch with multiple projects %s',
  (multipleProjects) => {
    const row = worktreeRow(
      {
        ...entry,
        title: 'fix/flaky-history',
        branch: 'fix/flaky-history',
        group: 'No review',
        reviewId: undefined,
      },
      multipleProjects,
      false,
    );
    expect(row.context).toEqual({ project: 'Porcelain', branch: undefined });
    expect(row.accessibilityLabel).toBe(
      'fix/flaky-history, Porcelain, No review',
    );
  },
);

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
    true,
  );
  expect(row.context).toEqual({
    project: 'Porcelain',
    branch: 'feat/pinned-files',
  });
  expect(row.icon).toBe('warning');
  expect(row.tone).toBe('destructive');
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
    false,
  );
  expect(row.accessibilityLabel).toBe(
    '/tmp/detached-worktree, Porcelain, Needs you, 0/0 decisions reviewed',
  );
  expect(row.context).toEqual({ project: undefined, branch: '' });
});
