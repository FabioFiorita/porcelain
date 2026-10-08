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
    ).toEqual(['Saved worktree is unavailable']);
    expect(workspaceChoices([laptop('reading')], saved).messages).toEqual([
      'Laptop · Reading projects…',
    ]);
    expect(
      workspaceChoices([], { ...saved, environmentId: 'forgotten' }).messages,
    ).toEqual(['No environments paired', 'Saved worktree is unavailable']);
  });
});
