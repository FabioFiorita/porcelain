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
          branch: 'refs/heads/main',
          available: true,
          status: undefined,
        },
      ],
    },
  ],
};
const input = {
  storage: { status: 'ready' as const, error: undefined },
  selection: { status: 'ready' as const, error: undefined },
  remembered: { projectId: 'project', worktreeId: 'main' },
  environment: { name: 'Saved laptop name' },
  inventory: { status: 'ready' as const, inventory },
};

describe('the selected workspace state', () => {
  it('waits for environment storage, saved selection and the first inventory', () => {
    expect(
      workspaceSelection({
        ...input,
        storage: { status: 'loading', error: undefined },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({
        ...input,
        selection: { status: 'loading', error: undefined },
      }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({ ...input, inventory: { status: 'reading' } }),
    ).toEqual({ kind: 'loading' });
    expect(
      workspaceSelection({
        ...input,
        storage: { status: 'loading', error: undefined },
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
    ).toEqual({ kind: 'failed', message: 'The server is offline.' });
  });

  it('reports unreadable saved state instead of waiting forever', () => {
    expect(
      workspaceSelection({
        ...input,
        storage: {
          status: 'unreadable',
          error: 'Could not read saved environments.',
        },
      }),
    ).toEqual({
      kind: 'failed',
      message: 'Could not read saved environments.',
    });
    expect(
      workspaceSelection({
        ...input,
        selection: {
          status: 'unreadable',
          error: 'Could not read saved workspaces.',
        },
      }),
    ).toEqual({ kind: 'failed', message: 'Could not read saved workspaces.' });
  });

  it('names the environment when the project is unavailable', () => {
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
      reason: 'This project is unavailable on Laptop.',
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
      reason: 'This worktree is no longer in the project.',
    });
    expect(workspaceSelection({ ...input, environment: undefined })).toEqual({
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

  it('returns the selected project and worktree', () => {
    const expected = {
      kind: 'selected',
      project: {
        id: 'project',
        name: 'Porcelain',
        available: true,
        worktrees: [
          {
            id: 'main',
            path: '/repo',
            main: true,
            branch: 'refs/heads/main',
            available: true,
            status: undefined,
          },
        ],
      },
      worktree: {
        id: 'main',
        path: '/repo',
        main: true,
        branch: 'refs/heads/main',
        available: true,
        status: undefined,
      },
    };
    expect(workspaceSelection(input)).toEqual(expected);
  });
});
