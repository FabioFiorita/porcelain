import { expect, it } from 'vitest';
import {
  openingWorktreeSection,
  shownWorktreeSection,
} from './worktree-section';

it('opens on Walkthrough only when a run exists, on Changes otherwise, and waits while the walkthrough is read', () => {
  expect(openingWorktreeSection({ walkthrough: true, pending: false })).toBe(
    'walkthrough',
  );
  expect(openingWorktreeSection({ walkthrough: false, pending: false })).toBe(
    'changes',
  );
  expect(
    openingWorktreeSection({ walkthrough: false, pending: true }),
  ).toBeUndefined();
});

it('shows the destination the developer chose, else the opening one', () => {
  expect(
    shownWorktreeSection({ chosen: 'history', opening: 'walkthrough' }),
  ).toBe('history');
  expect(
    shownWorktreeSection({ chosen: 'changes', opening: 'walkthrough' }),
  ).toBe('changes');
  expect(shownWorktreeSection({ chosen: undefined, opening: 'changes' })).toBe(
    'changes',
  );
});
