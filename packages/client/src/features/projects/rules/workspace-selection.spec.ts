import { describe, expect, it } from 'vitest';
import type { Inventory } from './inventory.ts';
import { workspaceSelection } from './workspace-selection.ts';

const inventory: Inventory = {
  environmentId: 'laptop',
  environment: { name: 'Laptop', custom: true },
  projects: [
    {
      id: 'project',
      name: 'Porcelain',
      available: true,
      worktrees: [
        {
          id: 'main',
          path: '/repo',
          main: true,
          branch: 'main',
          available: true,
          status: undefined,
        },
      ],
    },
  ],
};
const input = {
  readiness: {
    environmentsReady: true,
    selectionReady: true,
    failure: undefined,
  },
  remembered: { projectId: 'project', worktreeId: 'main' },
  paired: true,
  inventory: { status: 'ready' as const, inventory },
};

describe('the selected workspace state', () => {
  it('waits for environment storage, saved selection and the first inventory', () => {
    expect(
      workspaceSelection({
        ...input,
        readiness: { ...input.readiness, environmentsReady: false },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({
        ...input,
        readiness: { ...input.readiness, selectionReady: false },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({ ...input, inventory: { status: 'reading' } }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({
        ...input,
        readiness: { ...input.readiness, environmentsReady: false },
        remembered: undefined,
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('shows the failed inventory message', () => {
    expect(
      workspaceSelection({
        ...input,
        inventory: { status: 'failed', message: 'The server is offline.' },
      }),
    ).toEqual({
      kind: 'failed',
      source: 'inventory',
      message: 'The server is offline.',
    });
  });

  it('reports unreadable saved state instead of waiting forever', () => {
    expect(
      workspaceSelection({
        ...input,
        readiness: {
          ...input.readiness,
          failure: {
            source: 'storage',
            message: 'Could not read saved environments.',
          },
        },
      }),
    ).toEqual({
      kind: 'failed',
      source: 'storage',
      message: 'Could not read saved environments.',
    });
    expect(
      workspaceSelection({
        ...input,
        readiness: {
          ...input.readiness,
          failure: {
            source: 'selection',
            message: 'Could not read saved workspaces.',
          },
        },
      }),
    ).toEqual({
      kind: 'failed',
      source: 'selection',
      message: 'Could not read saved workspaces.',
    });
  });

  it('uses the shared unavailable reason for a server without a reason code', () => {
    expect(
      workspaceSelection({
        ...input,
        inventory: {
          status: 'ready',
          inventory: {
            ...inventory,
            projects: [{ ...inventory.projects[0]!, available: false }],
          },
        },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: "Porcelain can't reach this repository right now.",
    });
  });

  it('names the environment when the worktree is unavailable', () => {
    expect(
      workspaceSelection({
        ...input,
        inventory: {
          status: 'ready',
          inventory: {
            ...inventory,
            projects: [
              {
                ...inventory.projects[0]!,
                worktrees: [
                  { ...inventory.projects[0]!.worktrees[0]!, available: false },
                ],
              },
            ],
          },
        },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'This worktree is unavailable on Laptop.',
    });
  });

  it('distinguishes missing inventory entries from no saved choice', () => {
    expect(
      workspaceSelection({
        ...input,
        inventory: {
          status: 'ready',
          inventory: { ...inventory, projects: [] },
        },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'This project is no longer registered on Laptop.',
    });
    expect(
      workspaceSelection({
        ...input,
        inventory: {
          status: 'ready',
          inventory: {
            ...inventory,
            projects: [{ ...inventory.projects[0]!, worktrees: [] }],
          },
        },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'This worktree is no longer in the project on Laptop.',
    });
    expect(workspaceSelection({ ...input, paired: false })).toEqual({
      kind: 'unavailable',
      reason: 'This environment is no longer paired.',
    });
  });

  it('reports an unpaired saved environment even while its inventory is pending', () => {
    expect(
      workspaceSelection({
        ...input,
        paired: false,
        inventory: { status: 'reading' },
      }),
    ).toEqual({
      kind: 'unavailable',
      reason: 'This environment is no longer paired.',
    });
  });

  it('asks for a choice only after saved state has loaded with nothing remembered', () => {
    expect(
      workspaceSelection({
        ...input,
        remembered: undefined,
        inventory: { status: 'reading' },
      }),
    ).toEqual({ kind: 'none' });
    expect(
      workspaceSelection({
        ...input,
        remembered: undefined,
        inventory: { status: 'failed', message: 'Offline' },
      }),
    ).toEqual({ kind: 'none' });
  });
});
