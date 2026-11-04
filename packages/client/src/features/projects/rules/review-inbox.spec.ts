import { expect, it } from 'vitest';
import { reviewInbox, searchReviewInbox } from './review-inbox.ts';
import type { NavigatorEntry, NavigatorReview } from './worktree-navigator.ts';

function entry(
  name: string,
  review: NavigatorReview,
  project = { id: 'porcelain', name: 'Porcelain' },
  environment = { id: 'desk', name: 'Desk' },
): NavigatorEntry {
  return {
    key: `${environment.id}/${project.id}/${name}`,
    kind: 'worktree',
    environmentId: environment.id,
    environmentName: environment.name,
    projectId: project.id,
    projectName: project.name,
    worktreeId: name,
    path: `/worktrees/${name}`,
    name,
    branch: name,
    main: false,
    detached: false,
    available: true,
    review,
    changes: { state: 'unavailable' },
  };
}

function review(
  progress: { reviewed: number; total: number } | undefined,
  extra: Partial<Extract<NavigatorReview, { state: 'available' }>> = {},
): NavigatorReview {
  return {
    state: 'available',
    reviewId: `review-${progress?.reviewed ?? 'none'}`,
    closed: false,
    archived: false,
    pullRequestNumber: undefined,
    progress,
    ...extra,
  };
}

it('puts reviews with undecided stops under Needs you and out of their project', () => {
  const inbox = reviewInbox([
    entry('waiting', review({ reviewed: 1, total: 3 })),
    entry('done', review({ reviewed: 3, total: 3 })),
  ]);
  expect(
    inbox.needsYou.map((row) => [row.entry.name, row.status, row.label]),
  ).toEqual([['waiting', 'needs-you', '1/3 decisions']]);
  expect(
    inbox.projects.map((project) => [
      project.name,
      project.rows.map((row) => [row.entry.name, row.status]),
    ]),
  ).toEqual([['Porcelain', [['done', 'reviewed']]]]);
});

it('groups the remaining reviews by project and computer in name order', () => {
  const tastik = { id: 'tastik', name: 'Tastik' };
  const porcelain = { id: 'porcelain', name: 'Porcelain' };
  const laptop = { id: 'laptop', name: 'Laptop' };
  const inbox = reviewInbox([
    entry('menu', review({ reviewed: 2, total: 2 }), tastik),
    entry('shell', review({ reviewed: 1, total: 1 }), porcelain),
    entry('tabs', review({ reviewed: 4, total: 4 }), porcelain, laptop),
  ]);
  expect(
    inbox.projects.map((project) => [
      project.name,
      project.environmentName,
      project.rows.map((row) => row.entry.name),
    ]),
  ).toEqual([
    ['Porcelain', 'Desk', ['shell']],
    ['Porcelain', 'Laptop', ['tabs']],
    ['Tastik', 'Desk', ['menu']],
  ]);
});

it('leaves out worktrees without a review and closed reviews', () => {
  const inbox = reviewInbox([
    entry('plain', { state: 'none' }),
    entry('broken', { state: 'unavailable' }),
    entry('closed', review({ reviewed: 0, total: 2 }, { closed: true })),
  ]);
  expect(inbox.needsYou).toEqual([]);
  expect(inbox.projects).toEqual([]);
  expect(inbox.reading).toBe(false);
});

it('says when progress is still reading or could not be read', () => {
  const inbox = reviewInbox([
    entry('fresh', review(undefined)),
    entry('failed', review(undefined, { progressUnavailable: true })),
    entry('pending', { state: 'loading' }),
  ]);
  expect(inbox.needsYou).toEqual([]);
  expect(
    inbox.projects[0]?.rows.map((row) => [
      row.entry.name,
      row.status,
      row.label,
    ]),
  ).toEqual([
    ['fresh', 'reading', 'reading progress…'],
    ['failed', 'unavailable', 'progress unavailable'],
  ]);
  expect(inbox.reading).toBe(true);
});

it('searches every word across branch, project, computer and pull request, dropping emptied projects', () => {
  const tastik = { id: 'tastik', name: 'Tastik' };
  const laptop = { id: 'laptop', name: 'Laptop' };
  const inbox = reviewInbox([
    entry('feat/menu', review({ reviewed: 0, total: 2 }), tastik),
    entry('fix/shell', review({ reviewed: 1, total: 1 })),
    entry(
      'feat/tabs',
      review({ reviewed: 4, total: 4 }, { pullRequestNumber: 657 }),
      undefined,
      laptop,
    ),
  ]);
  const names = (query: string) => {
    const found = searchReviewInbox(inbox, query);
    return [
      found.needsYou.map((row) => row.entry.name),
      found.projects.map((project) => [
        project.environmentName,
        project.rows.map((row) => row.entry.name),
      ]),
    ];
  };
  expect(names('  ')).toEqual([
    ['feat/menu'],
    [
      ['Desk', ['fix/shell']],
      ['Laptop', ['feat/tabs']],
    ],
  ]);
  expect(names('FEAT')).toEqual([['feat/menu'], [['Laptop', ['feat/tabs']]]]);
  expect(names('feat laptop')).toEqual([[], [['Laptop', ['feat/tabs']]]]);
  expect(names('657')).toEqual([[], [['Laptop', ['feat/tabs']]]]);
  expect(names('tastik')).toEqual([['feat/menu'], []]);
  expect(names('nothing')).toEqual([[], []]);
});
