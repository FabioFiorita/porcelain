import { testClock } from '@porcelain/kernel/test-kit';
import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import {
  WorktreeCatalogStore,
  InventoryStore,
  CheckWorktreeOptions,
} from '@porcelain/projects/ports';
import { Effect, Clock } from 'effect';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import {
  type CatalogProject,
  type CatalogSnapshot,
  type ListedWorktree,
  type RegisteredProject,
} from '@porcelain/projects/models';
import {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import { describe, expect, it } from 'vitest';
import { InMemoryInventoryStore } from '../../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreeCatalogStore } from '../../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { ScriptedInventoryRefresh } from '../../../spec/fakes/scripted-inventory-refresh.ts';
import { CheckWorktreeUseCase } from './check-worktree.ts';

const now = '2026-09-24T12:00:00.000Z';
const longAgo = '2026-09-24T11:00:00.000Z';

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
  path: '/srv/api-feature',
  branch: 'refs/heads/feature',
  main: false,
  available: true,
  metadataIdentity: 'metadata-1',
  administrativeDirectory: '/srv/api/.git/worktrees/feature',
  commonDirectory: project.commonDirectory,
  repositoryIdentity: project.repositoryIdentity,
  repositoryId: project.repositoryIdentity,
};

function observed(
  observedAt: string,
  worktrees: ListedWorktree[],
): CatalogProject {
  return {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt,
      listed: true,
    },
    worktrees,
  };
}

async function useCase(before: CatalogSnapshot, afterRefresh: CatalogSnapshot) {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save(before);
  const inventory = new InMemoryInventoryStore([project]);
  const clock = await testClock(now);
  const staleness = { staleAfterMs: 60 * 1000 };
  return Effect.runSync(
    CheckWorktreeUseCase.pipe(
      Effect.provide(CheckWorktreeUseCase.layer),
      Effect.provideService(
        CheckWorktreeService,
        Effect.runSync(
          CheckWorktreeService.pipe(
            Effect.provide(CheckWorktreeService.layer),
            Effect.provideService(WorktreeCatalogStore, catalog),
            Effect.provideService(InventoryStore, inventory),
            Effect.provideService(Clock.Clock, clock),
            Effect.provideService(CheckWorktreeOptions, staleness),
          ),
        ),
      ),
      Effect.provideService(
        CheckRefreshedWorktreeService,
        Effect.runSync(
          CheckRefreshedWorktreeService.pipe(
            Effect.provide(CheckRefreshedWorktreeService.layer),
            Effect.provideService(WorktreeCatalogStore, catalog),
            Effect.provideService(InventoryStore, inventory),
            Effect.provideService(Clock.Clock, clock),
            Effect.provideService(CheckWorktreeOptions, staleness),
          ),
        ),
      ),
      Effect.provideService(
        InventoryRefresh,
        new ScriptedInventoryRefresh(catalog, afterRefresh),
      ),
    ),
  );
}

const check = { worktreeId: worktree.id, requireAvailableProject: false };

describe('CheckWorktreeUseCase', () => {
  it('answers a freshly observed worktree without refreshing the inventory', async () => {
    const subject = await useCase(
      { projects: [observed(now, [worktree])] },
      { projects: [observed(now, [])] },
    );
    await expect(Effect.runPromise(subject.execute(check))).resolves.toEqual(
      worktree,
    );
  });

  it('refreshes a stale worktree once and answers it as the refresh found it', async () => {
    const moved = { ...worktree, path: '/srv/api-moved' };
    const subject = await useCase(
      { projects: [observed(longAgo, [worktree])] },
      { projects: [observed(now, [moved])] },
    );
    await expect(Effect.runPromise(subject.execute(check))).resolves.toEqual(
      moved,
    );
  });

  it('refreshes before refusing a worktree no refresh has observed yet', async () => {
    const subject = await useCase(
      { projects: [] },
      { projects: [observed(now, [worktree])] },
    );
    await expect(Effect.runPromise(subject.execute(check))).resolves.toEqual(
      worktree,
    );
  });

  it('refuses a worktree the refresh did not find', async () => {
    const subject = await useCase(
      { projects: [] },
      { projects: [observed(now, [])] },
    );
    await expect(Effect.runPromise(subject.execute(check))).rejects.toThrow(
      WorktreeNotFoundError,
    );
  });

  it('refuses as unavailable a worktree still stale after the refresh', async () => {
    const stale = { projects: [observed(longAgo, [worktree])] };
    const subject = await useCase(stale, stale);
    await expect(Effect.runPromise(subject.execute(check))).rejects.toThrow(
      WorktreeUnavailableError,
    );
  });
});
