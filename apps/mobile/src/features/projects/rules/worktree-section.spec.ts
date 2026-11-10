import { expect, it } from 'vitest';
import {
  shownWorktreeSection,
  worktreeSectionChoices,
} from './worktree-section';

it('puts Walkthrough in the first slot, instead of Changes, when a run exists and keeps it one tap away otherwise', () => {
  expect(
    worktreeSectionChoices({ walkthrough: true, pending: false }).map(
      (section) => section.label,
    ),
  ).toEqual(['Walkthrough', 'Files', 'History']);
  expect(
    worktreeSectionChoices({ walkthrough: false, pending: false }).map(
      (section) => section.label,
    ),
  ).toEqual(['Changes', 'Walkthrough', 'Files', 'History']);
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
  ).toBe('walkthrough');
  expect(
    shownWorktreeSection({
      chosen: undefined,
      opening: 'changes',
      guide: plain,
    }),
  ).toBe('changes');
  expect(
    shownWorktreeSection({
      chosen: 'changes',
      opening: 'changes',
      guide: guided,
    }),
  ).toBe('walkthrough');
});
