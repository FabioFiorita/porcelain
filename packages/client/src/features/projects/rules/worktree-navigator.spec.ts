import { expect, it } from 'vitest';
import {
  emptyNavigatorFilter,
  navigatorEntryMatches,
  navigatorEntryLabel,
  navigatorChangesLabel,
  navigatorReviewLabel,
  navigatorCardReviewLabel,
  navigatorCardChangesLabel,
  navigatorChecksLabel,
  type NavigatorChanges,
  type NavigatorReview,
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
  review: {
    state: 'available',
    reviewId: 'review',
    closed: false,
    archived: false,
    pullRequestNumber: 42,
    timing: 'record',
    latestRevision: 1,
    lastSeenRevision: 1,
  },
  changes: { state: 'loading' },
};
it('describes publication purpose and a new revision without treating reading as a decision', () => {
  expect(navigatorCardReviewLabel(entry)).toBe('Review available');
  expect(
    navigatorCardReviewLabel({ ...entry, review: { state: 'none' } }),
  ).toBe('');
  const review = {
    state: 'available' as const,
    reviewId: 'review',
    closed: false,
    archived: false,
    pullRequestNumber: undefined,
    timing: 'decision' as const,
    latestRevision: 3,
    lastSeenRevision: 3,
  };
  expect(navigatorCardReviewLabel({ ...entry, review })).toBe(
    'Decision review',
  );
  expect(
    navigatorCardReviewLabel({
      ...entry,
      review: { ...review, lastSeenRevision: 2 },
    }),
  ).toBe('Decision review · New revision');
  expect(
    navigatorCardReviewLabel({
      ...entry,
      review: { ...review, timing: 'record', retained: true },
    }),
  ).toBe('Saved review');
  expect(
    navigatorCardReviewLabel({
      ...entry,
      review: { ...review, timing: 'record', lastSeenRevision: 2 },
    }),
  ).toBe('New revision');
});

it.each<{ changes: NavigatorChanges; label: string }>([
  { changes: { state: 'loading' }, label: 'Reading changes…' },
  { changes: { state: 'unavailable' }, label: 'Changes unavailable' },
  { changes: { state: 'available', count: 0 }, label: '' },
  { changes: { state: 'available', count: 1 }, label: '1 file changed' },
  { changes: { state: 'available', count: 3 }, label: '3 files changed' },
])('shows a quiet uncommitted file count: $label', ({ changes, label }) => {
  expect(navigatorCardChangesLabel(changes)).toBe(label);
});

it.each<{
  checks: Extract<NavigatorReview, { state: 'available' }>['checks'];
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
it('combines every search term and review choice while unknown review state remains visible', () => {
  expect(
    navigatorEntryMatches(
      entry,
      'PORCELAIN desk detached 42',
      emptyNavigatorFilter,
    ),
  ).toBe(true);
  expect(
    navigatorEntryMatches(
      entry,
      'Porcelain another-computer',
      emptyNavigatorFilter,
    ),
  ).toBe(false);
  expect(
    navigatorEntryMatches(entry, '', {
      ...emptyNavigatorFilter,
      reviews: ['without-review'],
    }),
  ).toBe(false);
  expect(
    navigatorEntryMatches({ ...entry, review: { state: 'none' } }, '', {
      ...emptyNavigatorFilter,
      reviews: ['with-review'],
    }),
  ).toBe(false);
  expect(
    navigatorEntryMatches({ ...entry, review: { state: 'loading' } }, '', {
      ...emptyNavigatorFilter,
      reviews: ['with-review'],
    }),
  ).toBe(true);
  expect(
    navigatorEntryMatches(entry, '', { ...emptyNavigatorFilter, reviews: [] }),
  ).toBe(false);
});
it('keeps selected checkout and retained-review identity scoped to their computer and row kind', () => {
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
  expect(
    navigatorEntrySelected(
      { ...entry, kind: 'review' },
      { kind: 'worktree', environmentId: 'desk', worktreeId: 'topic' },
    ),
  ).toBe(false);
  expect(
    navigatorEntrySelected(
      { ...entry, kind: 'review' },
      { kind: 'review', environmentId: 'desk', reviewId: 'review' },
    ),
  ).toBe(true);
  expect(
    navigatorEntrySelected(entry, {
      kind: 'review',
      environmentId: 'other',
      reviewId: 'review',
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
  expect(navigatorReviewLabel({ state: 'loading' })).toBe('Reading review…');
  expect(navigatorReviewLabel({ state: 'unavailable' })).toBe(
    'Review unavailable',
  );
  expect(navigatorReviewLabel({ state: 'none' })).toBe('No review');
  expect(navigatorEntryLabel(entry)).toBe(
    'long-detached-folder, Porcelain, Desk computer, Detached HEAD, /worktrees/long-detached-folder, Review available, Reading changes…, Pull request #42',
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
    reviews: [],
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
  expect(sections.find((section) => section.key === 'reviews')?.items).toEqual([
    {
      id: 'with-review',
      label: 'With a review',
      checked: false,
      next: ['with-review'],
    },
    {
      id: 'without-review',
      label: 'Without a review',
      checked: false,
      next: ['without-review'],
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
