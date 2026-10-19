import { expect, it } from 'vitest';
import { workspaceChoices, type Inventory } from './index.ts';
import { searchWorkspaces } from './workspace-search.ts';

function choices() {
  const environments = [
    ['beelink', 'Beelink', 'Tastik', 'tastik'],
    ['beelink', 'Beelink', 'Porcelain', 'porcelain'],
    ['mac', 'Mac', 'Porcelain', 'porcelain'],
  ].map(([id = '', name = '', projectName = '', projectId = '']) => ({
    environmentId: id,
    name,
    status: 'ready' as const,
    inventory: {
      environmentId: id,
      environment: { name, custom: true },
      projects: [
        {
          id: projectId,
          name: projectName,
          available: true,
          worktrees: [
            {
              id: 'main',
              path: `/code/${projectId}`,
              branch: 'refs/heads/main',
              main: true,
              available: true,
              status: undefined,
            },
            {
              id: 'travel',
              path: `/worktrees/${projectId}/travel`,
              branch: 'refs/heads/feat/tailscale',
              main: false,
              available: true,
              status: undefined,
            },
            {
              id: 'old',
              path: `/worktrees/${projectId}/old`,
              branch: 'refs/heads/feat/tailscale',
              main: false,
              available: false,
              status: undefined,
            },
          ],
        },
      ],
    } satisfies Inventory,
  }));
  return workspaceChoices(environments, {
    environmentId: 'beelink',
    projectId: 'porcelain',
    worktreeId: 'travel',
  }).choices;
}

it('finds branches across computers without losing the project or saved target', () => {
  const result = searchWorkspaces(
    choices(),
    '  PORCELAIN   tailscale Beelink ',
  );
  expect(result.map((choice) => [choice.key, choice.environmentName])).toEqual([
    ['beelink/porcelain', 'Beelink'],
  ]);
  expect(
    result[0]?.worktrees.map((row) => [
      row.workspace,
      row.selected,
      row.disabled,
    ]),
  ).toEqual([
    [
      {
        environmentId: 'beelink',
        projectId: 'porcelain',
        worktreeId: 'travel',
      },
      true,
      false,
    ],
    [
      { environmentId: 'beelink', projectId: 'porcelain', worktreeId: 'old' },
      false,
      true,
    ],
  ]);
});

it('searches folder paths, and shows an empty result for an unknown term', () => {
  const result = searchWorkspaces(choices(), 'porcelain /old');
  expect(
    result.map((choice) => [
      choice.environmentName,
      choice.worktrees.map((row) => row.workspace.worktreeId),
    ]),
  ).toEqual([
    ['Beelink', ['old']],
    ['Mac', ['old']],
  ]);
  expect(searchWorkspaces(choices(), 'does-not-exist')).toEqual([]);
});

it('returns an alphabetic project list when the search is cleared without mutating its inventory', () => {
  const input = choices();
  expect(searchWorkspaces(input, ' \n ').map((choice) => choice.key)).toEqual([
    'beelink/porcelain',
    'mac/porcelain',
    'beelink/tastik',
  ]);
  expect(input.map((choice) => choice.key)).toEqual([
    'beelink/tastik',
    'beelink/porcelain',
    'mac/porcelain',
  ]);
  expect(input.map((choice) => choice.worktrees.length)).toEqual([3, 3, 3]);
});

it('puts the current worktree first so reopening a large project reveals the selection', () => {
  expect(
    searchWorkspaces(choices(), '')[0]?.worktrees.map(
      (row) => row.workspace.worktreeId,
    ),
  ).toEqual(['travel', 'main', 'old']);
});

it('keeps a registered project with no worktrees findable by name', () => {
  const empty = { ...choices()[0]!, worktrees: [] };
  expect(
    searchWorkspaces([empty], 'tastik').map((choice) => [
      choice.key,
      choice.worktrees.length,
    ]),
  ).toEqual([['beelink/tastik', 0]]);
});
