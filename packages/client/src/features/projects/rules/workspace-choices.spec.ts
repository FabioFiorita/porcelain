import { describe, expect, it } from 'vitest';
import type { Inventory, Project } from './inventory.ts';
import {
  workspaceChoices,
  type EnvironmentInventory,
} from './workspace-choices.ts';

function project(id: string, available = true): Project {
  return {
    id,
    name: 'Porcelain',
    available,
    worktrees: [
      {
        id: `${id}-main`,
        path: `/repo/${id}`,
        main: true,
        branch: 'main',
        available: true,
        status: undefined,
      },
    ],
  };
}

function inventory(name: string, projects: Project[]): Inventory {
  return {
    environmentId: name.toLowerCase(),
    environment: { name, custom: true },
    projects,
  };
}

describe('choosing a workspace across paired environments', () => {
  it('lists every environment’s projects and keeps a healthy one visible while another fails', () => {
    const result = workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Saved laptop name',
          status: 'ready',
          inventory: inventory('Laptop', [project('one')]),
        },
        {
          environmentId: 'remote',
          name: 'Remote',
          status: 'failed',
          inventory: undefined,
        },
      ],
      undefined,
    );
    expect(
      result.choices.map(({ key, environmentName, project }) => [
        key,
        environmentName,
        project.id,
      ]),
    ).toEqual([['laptop/one', 'Laptop', 'one']]);
    expect(result.messages).toEqual(['Remote · Could not read projects']);
    expect(result.canReadAgain).toBe(true);
  });

  it('offers another read for an unavailable linked worktree while the selected worktree remains healthy', () => {
    const healthy = project('one');
    const result = workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Laptop',
          status: 'ready',
          inventory: inventory('Laptop', [
            {
              ...healthy,
              worktrees: [
                ...healthy.worktrees,
                {
                  id: 'one-linked',
                  path: '/repo/linked',
                  main: false,
                  branch: 'feature',
                  available: false,
                  status: undefined,
                },
              ],
            },
          ]),
        },
      ],
      { environmentId: 'laptop', projectId: 'one', worktreeId: 'one-main' },
    );
    expect(result.messages).toEqual([]);
    expect(result.canReadAgain).toBe(true);
  });

  it('flags a saved worktree that its own environment no longer offers, once that environment answers', () => {
    const laptop = (
      status: 'reading' | 'ready',
      inventory?: Inventory,
    ): EnvironmentInventory => ({
      environmentId: 'laptop',
      name: 'Laptop',
      status,
      inventory,
    });
    const saved = {
      environmentId: 'laptop',
      projectId: 'one',
      worktreeId: 'one-main',
    };
    expect(
      workspaceChoices(
        [laptop('ready', inventory('Laptop', [project('one')]))],
        saved,
      ).messages,
    ).toEqual([]);
    expect(
      workspaceChoices(
        [laptop('ready', inventory('Laptop', [project('one', false)]))],
        saved,
      ).messages,
    ).toEqual(["Porcelain can't reach this repository right now."]);
    expect(workspaceChoices([laptop('reading')], saved).messages).toEqual([
      'Laptop · Reading projects…',
    ]);
    expect(
      workspaceChoices([], { ...saved, environmentId: 'forgotten' }).messages,
    ).toEqual([
      'No environments paired',
      'This environment is no longer paired.',
    ]);
  });
});

it.each([
  [
    'moved',
    "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.",
  ],
  ['missing', 'The repository folder is missing.'],
  [
    'permission',
    'Porcelain cannot read this repository because access is denied.',
  ],
  ['git-failed', 'Git could not read this repository.'],
] as const)(
  'shows the selected project reason %s once and offers another read',
  (unavailableReason, reason) => {
    const result = workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Laptop',
          status: 'ready',
          inventory: inventory('Laptop', [
            { ...project('one', false), available: false, unavailableReason },
          ]),
        },
      ],
      { environmentId: 'laptop', projectId: 'one', worktreeId: 'one-main' },
    );
    expect(result.messages).toEqual([reason]);
    expect(result.canReadAgain).toBe(true);
  },
);

it('shows an unavailable project reason without a saved selection and offers another read', () => {
  const result = workspaceChoices(
    [
      {
        environmentId: 'laptop',
        name: 'Laptop',
        status: 'ready',
        inventory: inventory('Laptop', [
          {
            ...project('one', false),
            available: false,
            unavailableReason: 'permission',
          },
        ]),
      },
    ],
    undefined,
  );
  expect(result.messages).toEqual([
    'Laptop · Porcelain: Porcelain cannot read this repository because access is denied.',
  ]);
  expect(result.canReadAgain).toBe(true);
});

it('gives same-named worktrees distinct targets and labels, selecting only the saved environment', () => {
  const shared = project('shared');
  const result = workspaceChoices(
    ['Laptop', 'Remote'].map((name) => ({
      environmentId: name.toLowerCase(),
      name,
      status: 'ready' as const,
      inventory: inventory(name, [shared]),
    })),
    { environmentId: 'remote', projectId: 'shared', worktreeId: 'shared-main' },
  );
  expect(result.choices).toMatchObject([
    {
      worktrees: [
        {
          key: 'laptop/shared/shared-main',
          workspace: {
            environmentId: 'laptop',
            projectId: 'shared',
            worktreeId: 'shared-main',
          },
          label: 'main',
          accessibilityLabel: 'Select main in Porcelain on Laptop',
          selected: false,
          disabled: false,
        },
      ],
    },
    {
      worktrees: [
        {
          key: 'remote/shared/shared-main',
          workspace: {
            environmentId: 'remote',
            projectId: 'shared',
            worktreeId: 'shared-main',
          },
          label: 'main',
          accessibilityLabel: 'Select main in Porcelain on Remote',
          selected: true,
          disabled: false,
        },
      ],
    },
  ]);
});

it.each(['environment', 'project', 'worktree'] as const)(
  'disables an unavailable %s without disabling another healthy choice',
  (unavailable) => {
    const unhealthy = project('one', unavailable !== 'project');
    const result = workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Laptop',
          status: unavailable === 'environment' ? 'failed' : 'ready',
          inventory: inventory('Laptop', [
            {
              ...unhealthy,
              worktrees: unhealthy.worktrees.map((worktree) => ({
                ...worktree,
                available: unavailable !== 'worktree',
              })),
            },
          ]),
        },
        {
          environmentId: 'remote',
          name: 'Remote',
          status: 'ready',
          inventory: inventory('Remote', [project('two')]),
        },
      ],
      undefined,
    );
    expect(result.choices).toMatchObject([
      { worktrees: [{ disabled: true, selected: false }] },
      { worktrees: [{ disabled: false, selected: false }] },
    ]);
    expect(result.canReadAgain).toBe(true);
  },
);
