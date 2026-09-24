import { describe, expect, it } from 'vitest';
import type {
  RegisteredProject,
  ListedWorktree,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { ComposeInventoryService } from './compose-inventory-service.ts';

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
  };
}

function worktree(id: string, projectId: string): ListedWorktree {
  return {
    id,
    projectId,
    path: `/srv/${id}`,
    branch: undefined,
    main: true,
    available: true,
    metadataIdentity: id,
    administrativeDirectory: `/srv/${projectId}/.git`,
    commonDirectory: `/srv/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
  };
}

function listing(projectId: string, worktreeId: string) {
  return {
    projectId,
    available: true,
    complete: true,
    worktrees: [worktree(worktreeId, projectId)],
  };
}

describe('ComposeInventoryService', () => {
  it('reports registered projects in registration order with review status', () => {
    const inventory = new InMemoryInventoryStore('environment', [
      project('first'),
      project('second'),
    ]);
    expect(
      new ComposeInventoryService(inventory).execute({
        listings: [listing('second', 'w2'), listing('first', 'w1')],
        statuses: new Map([['w2', 'pending']]),
      }),
    ).toEqual({
      environmentId: 'environment',
      projects: [
        {
          id: 'first',
          name: 'first',
          available: true,
          worktrees: [
            {
              id: 'w1',
              path: '/srv/w1',
              main: true,
              branch: undefined,
              available: true,
              status: undefined,
            },
          ],
        },
        {
          id: 'second',
          name: 'second',
          available: true,
          worktrees: [
            {
              id: 'w2',
              path: '/srv/w2',
              main: true,
              branch: undefined,
              available: true,
              status: 'pending',
            },
          ],
        },
      ],
    });
  });

  it('leaves out a project removed while it was being listed', () => {
    const inventory = new InMemoryInventoryStore('environment', [
      project('kept'),
    ]);
    const report = new ComposeInventoryService(inventory).execute({
      listings: [listing('kept', 'w1'), listing('removed', 'w2')],
      statuses: new Map(),
    });
    expect(report.projects.map((entry) => entry.id)).toEqual(['kept']);
  });

  it('leaves out a project registered after the listing started', () => {
    const inventory = new InMemoryInventoryStore('environment', [
      project('listed'),
      project('late'),
    ]);
    const report = new ComposeInventoryService(inventory).execute({
      listings: [listing('listed', 'w1')],
      statuses: new Map(),
    });
    expect(report.projects.map((entry) => entry.id)).toEqual(['listed']);
  });
});
