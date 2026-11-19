import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import {
  type CatalogProject,
  type ListedWorktree,
  type RegisteredProject,
} from '@porcelain/projects/models';
import {
  InventoryStore,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { CheckRefreshedWorktreeService } from './check-refreshed-worktree-service.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  available: true,
  position: 1,
};

const worktree: ListedWorktree = {
  id: 'worktree-1',
  projectId: project.id,
  path: '/srv/api',
  branch: 'main',
  main: true,
  available: true,
  metadataIdentity: 'worktree-1',
  administrativeDirectory: '/srv/api/.git',
  commonDirectory: project.commonDirectory,
  repositoryIdentity: project.repositoryIdentity,
  repositoryId: project.repositoryIdentity,
};

function service(available: boolean, worktrees: ListedWorktree[]) {
  const snapshot: CatalogProject = {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt: '2026-09-24T12:00:00.000Z',
      available,
    },
    worktrees,
  };
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({ projects: [snapshot] });
  return Effect.runSync(
    CheckRefreshedWorktreeService.pipe(
      Effect.provide(CheckRefreshedWorktreeService.layer),
      Effect.provideService(WorktreeCatalogStore, catalog),
      Effect.provideService(
        InventoryStore,
        new InMemoryInventoryStore([project]),
      ),
    ),
  );
}

describe('CheckRefreshedWorktreeService', () => {
  it('refuses a worktree whose project the refresh found unavailable', () => {
    const checked = service(false, [worktree]);
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree the refresh did not find', () => {
    const checked = service(true, []);
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeNotFoundError);
  });
});
