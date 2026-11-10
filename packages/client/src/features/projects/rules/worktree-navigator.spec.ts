import { expect, it } from 'vitest';
import {
  emptyNavigatorFilter,
  navigatorEntryMatches,
  navigatorEntryLabel,
  navigatorChangesLabel,
  navigatorCardChangesLabel,
  navigatorChecksLabel,
  type NavigatorChanges,
  type NavigatorPullRequest,
  navigatorFilterSections,
  navigatorEntrySelected,
  reconcileNavigatorStatusNotices,
  navigatorWorktreeOrder,
  type NavigatorEntry,
} from './worktree-navigator.ts';

const entry: NavigatorEntry = {
  key: 'desk/project/topic',
  kind: 'worktree',
  environmentId: 'desk',
  environmentName: 'Desk computer',
  projectId: 'project',
  projectName: 'Porcelain',
  worktreeId: 'topic',
  path: '/worktrees/long-detached-folder',
  name: 'long-detached-folder',
  branch: 'Detached HEAD',
  main: false,
  detached: true,
  available: true,
  pullRequest: { state: 'available', number: 42 },
  changes: { state: 'loading' },
};
it.each<{ changes: NavigatorChanges; label: string }>([
  { changes: { state: 'loading' }, label: 'Reading changes…' },
  { changes: { state: 'unavailable' }, label: '—' },
  { changes: { state: 'available', count: 0 }, label: '' },
  { changes: { state: 'available', count: 1 }, label: '1 file changed' },
  { changes: { state: 'available', count: 3 }, label: '3 files changed' },
])('shows a quiet uncommitted file count: $label', ({ changes, label }) => {
  expect(navigatorCardChangesLabel(changes)).toBe(label);
});

it.each<{
  checks: Extract<NavigatorPullRequest, { state: 'available' }>['checks'];
  label: string;
}>([
  { checks: undefined, label: 'Checks loading' },
  { checks: { state: 'loading' }, label: 'Checks loading' },
  { checks: { state: 'unavailable' }, label: 'Checks unavailable' },
  { checks: { state: 'available', result: 'passed' }, label: 'Checks passed' },
  {
    checks: { state: 'available', result: 'running' },
    label: 'Checks running',
  },
  { checks: { state: 'available', result: 'failed' }, label: 'Checks failed' },
  { checks: { state: 'available', result: 'none' }, label: 'No checks' },
])('keeps PR check status accessible in words: $label', ({ checks, label }) => {
  expect(navigatorChecksLabel(checks)).toBe(label);
});
it('combines every search term including project, environment, path and PR number', () => {
  expect(navigatorEntryMatches(entry, 'PORCELAIN desk detached 42')).toBe(true);
  expect(navigatorEntryMatches(entry, 'Porcelain another-computer')).toBe(
    false,
  );
});
it('keeps selected checkout identity scoped to its computer', () => {
  expect(
    navigatorEntrySelected(entry, {
      kind: 'worktree',
      environmentId: 'desk',
      worktreeId: 'topic',
    }),
  ).toBe(true);
  expect(
    navigatorEntrySelected(entry, {
      kind: 'worktree',
      environmentId: 'other',
      worktreeId: 'topic',
    }),
  ).toBe(false);
});

it('keeps pending and failed details distinct from no review and a clean checkout in visible and accessible labels', () => {
  expect(navigatorChangesLabel({ state: 'loading' })).toBe('Reading changes…');
  expect(navigatorChangesLabel({ state: 'unavailable' })).toBe(
    'Changes unavailable',
  );
  expect(navigatorChangesLabel({ state: 'available', count: 0 })).toBe(
    'Working tree clean',
  );
  expect(navigatorEntryLabel(entry)).toBe(
    'long-detached-folder, Porcelain, Desk computer, Detached HEAD, /worktrees/long-detached-folder, Reading changes…, Pull request #42',
  );
});

it('offers both same-named projects as scoped choices and keeps an empty review selection distinct from all choices', () => {
  const projects = [
    {
      key: 'desk/project',
      name: 'Porcelain',
      environmentId: 'desk',
      environmentName: 'Desk',
      environmentIcon: 'desktop' as const,
    },
    {
      key: 'laptop/project',
      name: 'Porcelain',
      environmentId: 'laptop',
      environmentName: 'Laptop',
      environmentIcon: 'laptop' as const,
    },
  ];
  const sections = navigatorFilterSections(projects, {
    ...emptyNavigatorFilter,
    projects: ['laptop/project'],
  });
  expect(sections.find((section) => section.key === 'projects')?.items).toEqual(
    [
      {
        id: 'desk/project',
        label: 'Porcelain · Desk',
        checked: false,
        next: ['laptop/project', 'desk/project'],
      },
      {
        id: 'laptop/project',
        label: 'Porcelain · Laptop',
        checked: true,
        next: [],
      },
    ],
  );
  expect(
    sections.find((section) => section.key === 'environments')?.items,
  ).toEqual([
    {
      id: 'desk',
      label: 'Desk',
      icon: 'desktop',
      checked: true,
      next: ['laptop'],
    },
    {
      id: 'laptop',
      label: 'Laptop',
      icon: 'laptop',
      checked: true,
      next: ['desk'],
    },
  ]);
});

it('keeps the main worktree first, then the newest head commit, with undated worktrees last by name', () => {
  const worktree = (name: string, headCommittedAt?: string, main = false) => ({
    key: `desk/project/${name}`,
    name,
    main,
    ...(headCommittedAt ? { headCommittedAt } : {}),
  });
  expect(
    [
      worktree('unborn'),
      worktree('older', '2026-10-01T09:00:00.000Z'),
      worktree('beta', '2026-10-30T12:00:00.000Z'),
      worktree('main', '2026-01-01T00:00:00.000Z', true),
      worktree('alpha', '2026-10-30T12:00:00.000Z'),
      worktree('newest', '2026-10-31T08:00:00.000Z'),
      worktree('catalog-only'),
    ]
      .sort(navigatorWorktreeOrder)
      .map((entry) => entry.name),
  ).toEqual([
    'main',
    'newest',
    'alpha',
    'beta',
    'older',
    'catalog-only',
    'unborn',
  ]);
});

it('retains dismissed failures across hidden scopes and removes only confirmed recovery or stale checkout identity', () => {
  const notice = {
    environmentId: entry.environmentId,
    environmentName: entry.environmentName,
    failures: [{ entry, detail: 'Inspection failed' }],
    dismissed: true,
  };
  const hidden = {
    issues: [],
    recoveredKeys: [],
    inventoryKeys: [entry.key],
    environments: [entry.environmentId],
  };
  expect(reconcileNavigatorStatusNotices([notice], hidden)).toEqual([notice]);
  expect(
    reconcileNavigatorStatusNotices([notice], {
      ...hidden,
      recoveredKeys: [entry.key],
    }),
  ).toEqual([]);
  expect(
    reconcileNavigatorStatusNotices([notice], { ...hidden, inventoryKeys: [] }),
  ).toEqual([]);
  expect(
    reconcileNavigatorStatusNotices([notice], {
      ...hidden,
      environments: [],
      inventoryKeys: [],
    }),
  ).toEqual([notice]);
  const failure = { entry, detail: 'Access denied' };
  expect(
    reconcileNavigatorStatusNotices([notice], {
      ...hidden,
      issues: [{ ...notice, failures: [failure] }],
    }),
  ).toEqual([{ ...notice, failures: [failure] }]);
  expect(
    reconcileNavigatorStatusNotices([], { ...hidden, issues: [notice] })[0]
      ?.dismissed,
  ).toBe(false);
});
