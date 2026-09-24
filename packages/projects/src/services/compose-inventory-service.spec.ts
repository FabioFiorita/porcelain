import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  ProjectWorktrees,
  RegisteredProject,
} from '@porcelain/projects/models';
import { ComposeInventoryService } from './compose-inventory-service.ts';

function project(id: string, position: number): RegisteredProject {
  return {
    id,
    name: `name-${id}`,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position,
  };
}

function worktree(id: string, projectId: string): ListedWorktree {
  return {
    id,
    projectId,
    path: `/srv/${id}`,
    branch: 'refs/heads/main',
    main: true,
    available: true,
    metadataIdentity: id,
    administrativeDirectory: `/srv/${projectId}/.git`,
    commonDirectory: `/srv/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
  };
}

function listing(
  projectId: string,
  worktrees: ListedWorktree[],
  available = true,
): ProjectWorktrees {
  return { projectId, available, worktrees };
}

const service = new ComposeInventoryService();

describe('ComposeInventoryService', () => {
  it('reports every project in inventory order with its worktrees and review status', () => {
    expect(
      service.execute({
        inventory: {
          environmentId: 'environment',
          projects: [project('first', 1), project('second', 2)],
        },
        listings: [
          listing('second', [worktree('w2', 'second')]),
          listing('first', [worktree('w1', 'first')]),
        ],
        statuses: new Map([['w2', 'pending']]),
      }),
    ).toEqual({
      environmentId: 'environment',
      projects: [
        {
          id: 'first',
          name: 'name-first',
          available: true,
          worktrees: [
            {
              id: 'w1',
              path: '/srv/w1',
              main: true,
              branch: 'refs/heads/main',
              available: true,
              status: undefined,
            },
          ],
        },
        {
          id: 'second',
          name: 'name-second',
          available: true,
          worktrees: [
            {
              id: 'w2',
              path: '/srv/w2',
              main: true,
              branch: 'refs/heads/main',
              available: true,
              status: 'pending',
            },
          ],
        },
      ],
    });
  });

  it('reports a project as unavailable when its listing was', () => {
    const report = service.execute({
      inventory: { environmentId: 'environment', projects: [project('a', 1)] },
      listings: [listing('a', [], false)],
      statuses: new Map(),
    });
    expect(report.projects[0]?.available).toBe(false);
  });

  it('reports a project with no known worktrees with an empty list', () => {
    const report = service.execute({
      inventory: { environmentId: 'environment', projects: [project('a', 1)] },
      listings: [listing('a', [])],
      statuses: new Map(),
    });
    expect(report.projects[0]?.worktrees).toEqual([]);
  });

  it('reports only registered projects, whatever the listings hold', () => {
    const report = service.execute({
      inventory: {
        environmentId: 'environment',
        projects: [project('kept', 1)],
      },
      listings: [
        listing('kept', [worktree('w1', 'kept')]),
        listing('removed', [worktree('w2', 'removed')]),
      ],
      statuses: new Map(),
    });
    expect(report.projects.map((entry) => entry.id)).toEqual(['kept']);
  });
});
