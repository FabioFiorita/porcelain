import { expect, it } from 'vitest';
import {
  openingWorktreeSection,
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
