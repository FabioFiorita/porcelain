import { expect, it } from 'vitest';
import {
  openingWorktreeSection,
  shownWorktreeSection,
  worktreeSectionChoices,
  worktreeSectionNamed,
} from './worktree-section';

const clean = { state: 'available', count: 0 } as const;
const changed = { state: 'available', count: 3 } as const;
const review = {
  state: 'available',
  reviewId: 'review',
  closed: false,
  archived: false,
  pullRequestNumber: undefined,
  timing: 'decision',
  latestRevision: 1,
  lastSeenRevision: 1,
} as const;

it('opens a clean worktree without a review on Files', () => {
  expect(
    openingWorktreeSection({ review: { state: 'none' }, changes: clean }),
  ).toBe('files');
});

it('opens a worktree with changes on Changes', () => {
  expect(
    openingWorktreeSection({ review: { state: 'none' }, changes: changed }),
  ).toBe('changes');
});

it('opens a clean worktree with a review on Changes', () => {
  expect(openingWorktreeSection({ review, changes: clean })).toBe('changes');
});

it('opens on Changes while the worktree status is still unknown', () => {
  expect(
    openingWorktreeSection({
      review: { state: 'none' },
      changes: { state: 'loading' },
    }),
  ).toBe('changes');
  expect(
    openingWorktreeSection({
      review: { state: 'loading' },
      changes: clean,
    }),
  ).toBe('changes');
});

it('reads a section from a route parameter', () => {
  expect(worktreeSectionNamed('history')).toBe('history');
  expect(worktreeSectionNamed('settings')).toBe('changes');
  expect(worktreeSectionNamed(undefined)).toBe('changes');
});

it('offers Walkthrough first only when the worktree has or can get one', () => {
  expect(
    worktreeSectionChoices({ walkthrough: true, pending: false }).map(
      (section) => section.label,
    ),
  ).toEqual(['Walkthrough', 'Changes', 'Files', 'History']);
  expect(
    worktreeSectionChoices({ walkthrough: false, pending: false }).map(
      (section) => section.label,
    ),
  ).toEqual(['Changes', 'Files', 'History']);
});

it('keeps the chosen section while it is offered, else falls back to the opening one', () => {
  const guided = { walkthrough: true, pending: false };
  const plain = { walkthrough: false, pending: false };
  expect(
    shownWorktreeSection({
      chosen: 'history',
      opening: 'walkthrough',
      guide: guided,
    }),
  ).toBe('history');
  expect(
    shownWorktreeSection({
      chosen: undefined,
      opening: 'walkthrough',
      guide: guided,
    }),
  ).toBe('walkthrough');
  expect(
    shownWorktreeSection({
      chosen: 'walkthrough',
      opening: 'files',
      guide: plain,
    }),
  ).toBe('files');
  expect(
    shownWorktreeSection({
      chosen: undefined,
      opening: 'walkthrough',
      guide: plain,
    }),
  ).toBe('changes');
});
