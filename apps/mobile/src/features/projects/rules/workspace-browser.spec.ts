import { expect, it } from 'vitest';
import {
  workspaceChoices,
  type Inventory,
} from '@porcelain/client/projects/rules';
import { worktreeDescription } from './workspace-browser';

it('distinguishes same-named worktrees by their path and labels current, main and unavailable rows', () => {
  const inventory: Inventory = {
    environmentId: 'beelink',
    environment: { name: 'Beelink', custom: true },
    projects: [
      {
        id: 'porcelain',
        name: 'Porcelain',
        available: true,
        worktrees: ['main', 'travel', 'old'].map((id) => ({
          id,
          path: `/worktrees/porcelain/${id}`,
          branch:
            id === 'main' ? 'refs/heads/main' : 'refs/heads/feat/tailscale',
          main: id === 'main',
          available: id !== 'old',
          status: undefined,
        })),
      },
    ],
  };
  const choice = workspaceChoices(
    [{ environmentId: 'beelink', name: 'Beelink', status: 'ready', inventory }],
    { environmentId: 'beelink', projectId: 'porcelain', worktreeId: 'travel' },
  ).choices[0]!;
  expect(
    choice.worktrees.map((row) => worktreeDescription(choice, row)),
  ).toEqual([
    'Main checkout',
    'Current · /worktrees/porcelain/travel',
    'Unavailable · /worktrees/porcelain/old',
  ]);
});
