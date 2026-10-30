import { expect, it } from 'vitest';
import {
  emptyNavigatorFilter,
  navigatorEntryMatches,
  navigatorEntryLabel,
  navigatorChangesLabel,
  navigatorReviewLabel,
  navigatorFilterSections,
  navigatorEntrySelected,
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
