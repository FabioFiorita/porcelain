import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { testClock } from '@porcelain/kernel/test-kit';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import {
  type CatalogProject,
  type ListedWorktree,
  type RegisteredProject,
} from '@porcelain/projects/models';
import {
  CheckWorktreeOptions,
  InventoryStore,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import { Clock, Effect } from 'effect';
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

async function service(
  observedAt: string,
  worktrees: ListedWorktree[] = [worktree],
) {
  const snapshot: CatalogProject = {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt,
      available: true,
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
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-09-24T12:00:00.000Z'),
      ),
      Effect.provideService(CheckWorktreeOptions, { staleAfterMs: 60 * 1000 }),
    ),
  );
}

describe('CheckRefreshedWorktreeService', () => {
  it('refuses a worktree the refresh did not observe as unavailable instead of asking for another refresh', async () => {
    const checked = await service('2026-09-24T11:00:00.000Z');
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree the refresh did not find', async () => {
    const checked = await service('2026-09-24T12:00:00.000Z', []);
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
