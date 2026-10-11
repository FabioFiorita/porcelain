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
        branch: 'refs/heads/main',
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

  it('separates the same project in two environments', () => {
    const shared = project('shared');
    const result = workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Laptop',
          status: 'ready',
          inventory: inventory('Laptop', [shared]),
        },
        {
          environmentId: 'remote',
          name: 'Remote',
          status: 'ready',
          inventory: inventory('Remote', [shared]),
        },
      ],
      undefined,
    );
    expect(result.choices.map(({ key }) => key)).toEqual([
      'laptop/shared',
      'remote/shared',
    ]);
    expect(result.messages).toEqual([]);
    expect(result.canReadAgain).toBe(false);
  });

  it('reports reading, empty and unpaired states', () => {
    expect(workspaceChoices([], undefined).messages).toEqual([
      'No environments paired',
    ]);
    expect(
      workspaceChoices(
        [
          {
            environmentId: 'laptop',
            name: 'Laptop',
            status: 'reading',
            inventory: undefined,
          },
          {
            environmentId: 'remote',
            name: 'Remote',
            status: 'ready',
            inventory: inventory('Remote', []),
          },
        ],
        undefined,
      ).messages,
    ).toEqual([
      'Laptop · Reading projects…',
      'Remote · No projects registered',
    ]);
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
    ).toEqual(['This project is unavailable on Laptop.']);
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

it('uses the selection rule reason in the picker, including unpaired and pending environments', () => {
  const saved = {
    environmentId: 'laptop',
    projectId: 'one',
    worktreeId: 'one-main',
  };
  const result = workspaceChoices(
    [
      {
        environmentId: 'laptop',
        name: 'Saved laptop name',
        status: 'ready',
        inventory: inventory('Laptop', [project('one', false)]),
      },
    ],
    saved,
  );
  expect(result.messages).toEqual(['This project is unavailable on Laptop.']);
  expect(workspaceChoices([], saved).messages).toEqual([
    'No environments paired',
    'This environment is no longer paired.',
  ]);
  expect(
    workspaceChoices(
      [
        {
          environmentId: 'laptop',
          name: 'Laptop',
          status: 'reading',
          inventory: undefined,
        },
      ],
      saved,
    ).messages,
  ).toEqual(['Laptop · Reading projects…']);
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
