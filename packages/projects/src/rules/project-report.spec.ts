import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  ProjectWorktrees,
  RegisteredProject,
} from '@porcelain/projects/models';
import { inventoryReport, registeredProjectReport } from './project-report.ts';

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
    repositoryId: `identity-${projectId}`,
  };
}

function listing(
  projectId: string,
  worktrees: ListedWorktree[],
  available = true,
): ProjectWorktrees {
  return { projectId, available, worktrees };
}

describe('inventoryReport', () => {
  it('reports every project in inventory order with its worktrees and review status', () => {
    expect(
      inventoryReport(
        'environment',
        {
          projects: [project('first', 1), project('second', 2)],
        },
        [
          listing('second', [worktree('w2', 'second')]),
          listing('first', [worktree('w1', 'first')]),
        ],
        new Map([['w2', 'pending']]),
      ),
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
    const report = inventoryReport(
      'environment',
      { projects: [project('a', 1)] },
      [listing('a', [], false)],
      new Map(),
    );
    expect(report.projects[0]?.available).toBe(false);
  });

  it('reports a project with no known worktrees with an empty list', () => {
    const report = inventoryReport(
      'environment',
      { projects: [project('a', 1)] },
      [listing('a', [])],
      new Map(),
    );
    expect(report.projects[0]?.worktrees).toEqual([]);
  });

  it('reports only registered projects, whatever the listings hold', () => {
    const report = inventoryReport(
      'environment',
      { projects: [project('kept', 1)] },
      [
        listing('kept', [worktree('w1', 'kept')]),
        listing('removed', [worktree('w2', 'removed')]),
      ],
      new Map(),
    );
    expect(report.projects.map((entry) => entry.id)).toEqual(['kept']);
  });
});

describe('registeredProjectReport', () => {
  it('reports the registered project with the worktrees the refresh listed for it', () => {
    expect(
      registeredProjectReport(
        project('second', 2),
        [
          listing('first', [worktree('w1', 'first')]),
          listing('second', [worktree('w2', 'second')], false),
        ],
        new Map(),
      ),
    ).toEqual({
      id: 'second',
      name: 'name-second',
      available: false,
      worktrees: [
        {
          id: 'w2',
          path: '/srv/w2',
          main: true,
          branch: 'refs/heads/main',
          available: true,
          status: undefined,
        },
      ],
    });
  });

  it('reports the project unavailable and without worktrees when the refresh no longer lists it', () => {
    expect(registeredProjectReport(project('gone', 1), [], new Map())).toEqual({
      id: 'gone',
      name: 'name-gone',
      available: false,
      worktrees: [],
    });
  });
});
