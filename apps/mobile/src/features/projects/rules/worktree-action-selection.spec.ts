import { expect, it } from 'vitest';
import { worktreeActionSelected } from './worktree-action-selection';

const target = {
  environmentId: 'computer-a',
  projectId: 'project-a',
  worktreeId: 'worktree-a',
};
const selected = {
  currentEnvironmentId: 'computer-a',
  selections: {
    'computer-a': { projectId: 'project-a', worktreeId: 'worktree-a' },
  },
};

it('guards and replaces only the worktree actually selected on its computer', () => {
  expect(worktreeActionSelected(selected, target)).toBe(true);
});

it.each([
  { ...target, environmentId: 'computer-b' },
  { ...target, projectId: 'project-b' },
  { ...target, worktreeId: 'worktree-b' },
])('does not leave the selected document for another target %j', (other) => {
  expect(worktreeActionSelected(selected, other)).toBe(false);
});

it('does not guard a remembered worktree on a computer that is not active', () => {
  expect(
    worktreeActionSelected(
      {
        currentEnvironmentId: 'computer-b',
        selections: {
          ...selected.selections,
          'computer-b': { projectId: 'project-a', worktreeId: 'worktree-a' },
        },
      },
      target,
    ),
  ).toBe(false);
});
