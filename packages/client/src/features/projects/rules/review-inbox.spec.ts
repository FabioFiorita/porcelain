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
  extra: Partial<Extract<NavigatorReview, { state: 'available' }>> = {},
): NavigatorReview {
  return {
    state: 'available',
    reviewId: 'review',
    closed: false,
    archived: false,
    pullRequestNumber: undefined,
    timing: 'record',
    latestRevision: 1,
    lastSeenRevision: 1,
    ...extra,
  };
}

it('separates decision publications by their explicit purpose, including ones already read', () => {
  const inbox = reviewInbox([
    entry(
      'decision',
      review({ timing: 'decision', latestRevision: 3, lastSeenRevision: 3 }),
    ),
    entry('record', review()),
  ]);
  expect(
    inbox.decisions.map((row) => [row.entry.name, row.status, row.label]),
  ).toEqual([['decision', 'decision', 'Decision review']]);
  expect(
    inbox.projects[0]?.rows.map((row) => [row.entry.name, row.status]),
  ).toEqual([['record', 'available']]);
});

it('does not turn unread routine records into owner decisions', () => {
  const inbox = reviewInbox([
    entry(
      'routine',
      review({ timing: 'record', latestRevision: 3, lastSeenRevision: 0 }),
    ),
  ]);
  expect(inbox.decisions).toEqual([]);
  expect(
    inbox.projects[0]?.rows.map((row) => [
      row.entry.name,
      row.status,
      row.label,
    ]),
  ).toEqual([['routine', 'new', 'New revision']]);
});

it('groups routine reviews by project and computer in name order', () => {
  const tastik = { id: 'tastik', name: 'Tastik' };
  const porcelain = { id: 'porcelain', name: 'Porcelain' };
  const laptop = { id: 'laptop', name: 'Laptop' };
  const inbox = reviewInbox([
    entry('menu', review(), tastik),
    entry('shell', review(), porcelain),
    entry('tabs', review(), porcelain, laptop),
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
    entry('closed', review({ closed: true })),
  ]);
  expect(inbox.decisions).toEqual([]);
  expect(inbox.projects).toEqual([]);
  expect(inbox.reading).toBe(false);
});

it('shows closed publications only in requested history without asking for a decision', () => {
  const closed = entry('closed', review({ timing: 'decision', closed: true }));
  const inbox = reviewInbox([closed], true);
  expect(inbox.decisions).toEqual([]);
  expect(
    inbox.projects[0]?.rows.map((row) => [row.entry.name, row.label]),
  ).toEqual([['closed', 'Closed review']]);
});

it('retains the loading state without inventing a reading obligation', () => {
  const inbox = reviewInbox([entry('pending', { state: 'loading' })]);
  expect(inbox.decisions).toEqual([]);
  expect(inbox.projects).toEqual([]);
  expect(inbox.reading).toBe(true);
});

it('searches every word across branch, project, computer and pull request, dropping emptied projects', () => {
  const tastik = { id: 'tastik', name: 'Tastik' };
  const laptop = { id: 'laptop', name: 'Laptop' };
  const inbox = reviewInbox([
    entry('feat/menu', review({ timing: 'decision' }), tastik),
    entry('fix/shell', review()),
    entry('feat/tabs', review({ pullRequestNumber: 657 }), undefined, laptop),
  ]);
  const names = (query: string) => {
    const found = searchReviewInbox(inbox, query);
    return [
      found.decisions.map((row) => row.entry.name),
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
