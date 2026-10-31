import { expect, it } from 'vitest';
import {
  emptyNavigatorFilter,
  navigatorEntryMatches,
  navigatorEntryLabel,
  navigatorChangesLabel,
  navigatorReviewLabel,
  navigatorCardReviewLabel,
  navigatorCardChangesLabel,
  navigatorDiffSummary,
  navigatorChecksLabel,
  type NavigatorChanges,
  type NavigatorReview,
  navigatorFilterSections,
  navigatorEntrySelected,
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
    progress: undefined,
  },
  changes: { state: 'loading' },
};
it('uses decision progress without empty review filler in compact cards', () => {
  expect(
    navigatorCardReviewLabel({
      ...entry,
      detached: false,
      review: {
        state: 'available',
        reviewId: 'review',
        closed: false,
        archived: false,
        pullRequestNumber: 42,
        progress: { reviewed: 3, total: 12 },
      },
    }),
  ).toBe('3/12 decisions');
  expect(
    navigatorCardReviewLabel({ ...entry, review: { state: 'none' } }),
  ).toBe('');
  expect(
    navigatorCardReviewLabel({
      ...entry,
      detached: false,
      review: {
        state: 'available',
        reviewId: 'retained',
        closed: false,
        archived: false,
        retained: true,
        pullRequestNumber: undefined,
        progress: undefined,
      },
    }),
  ).toBe('Retained review');
});

it.each<{ changes: NavigatorChanges; label: string }>([
  { changes: { state: 'loading' }, label: 'Reading changes…' },
  { changes: { state: 'unavailable' }, label: 'Changes unavailable' },
  { changes: { state: 'available', count: 0 }, label: '' },
  {
    changes: { state: 'available', count: 2, summary: { state: 'loading' } },
    label: '2 files',
  },
  {
    changes: {
      state: 'available',
      count: 1,
      summary: { state: 'unavailable' },
    },
    label: '1 file',
  },
  {
    changes: {
      state: 'available',
      count: 1,
      summary: {
        state: 'available',
        additions: 0,
        deletions: 0,
        binaryFiles: 0,
      },
    },
    label: '1 file',
  },
  {
    changes: {
      state: 'available',
      count: 3,
      summary: {
        state: 'available',
        additions: 12,
        deletions: 4,
        binaryFiles: 0,
      },
    },
    label: '+12 −4',
  },
  {
    changes: {
      state: 'available',
      count: 1,
      summary: {
        state: 'available',
        additions: 0,
        deletions: 0,
        binaryFiles: 1,
      },
    },
    label: '+0 −0 · 1 binary',
  },
])('shows honest compact change information: $label', ({ changes, label }) => {
  expect(navigatorCardChangesLabel(changes)).toBe(label);
});

it('only exposes a numeric diff summary when there are line changes or binary files', () => {
  expect(navigatorDiffSummary({ state: 'loading' })).toBeUndefined();
  expect(
    navigatorDiffSummary({
      state: 'available',
      count: 2,
      summary: {
        state: 'available',
        additions: 0,
        deletions: 0,
        binaryFiles: 0,
      },
    }),
  ).toBeUndefined();
  expect(
    navigatorDiffSummary({
      state: 'available',
      count: 1,
      summary: {
        state: 'available',
        additions: 0,
        deletions: 0,
        binaryFiles: 1,
      },
    }),
  ).toEqual({ state: 'available', additions: 0, deletions: 0, binaryFiles: 1 });
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
    'Working tree unavailable',
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
    'long-detached-folder, Porcelain, Desk computer, Detached HEAD, /worktrees/long-detached-folder, Review · reading progress…, Reading changes…, Pull request #42',
  );
});

it('offers both same-named projects as scoped choices and keeps an empty review selection distinct from all choices', () => {
  const projects = [
    {
      key: 'desk/project',
      name: 'Porcelain',
      environmentId: 'desk',
      environmentName: 'Desk',
    },
    {
      key: 'laptop/project',
      name: 'Porcelain',
      environmentId: 'laptop',
      environmentName: 'Laptop',
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
