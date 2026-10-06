import { testClock } from '@porcelain/kernel/test-kit';
import {
  WorktreeCatalogStore,
  InventoryStore,
  CheckWorktreeOptions,
} from '@porcelain/projects/ports';
import { Effect, Clock } from 'effect';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import {
  type CatalogObservation,
  type CatalogProject,
  type ListedWorktree,
  type RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { CheckWorktreeService } from './check-worktree-service.ts';

const MINUTE_MS = 60 * 1000;
const now = '2026-09-24T12:00:00.000Z';

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

function observed(
  overrides: Partial<CatalogObservation> = {},
  worktrees: ListedWorktree[] = [worktree],
): CatalogProject {
  return {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt: '2026-09-24T11:59:30.000Z',
      listed: true,
      ...overrides,
    },
    worktrees,
  };
}

async function service(
  options: {
    catalog?: CatalogProject[];
    projects?: RegisteredProject[];
  } = {},
) {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({ projects: options.catalog ?? [observed()] });
  return Effect.runSync(
    CheckWorktreeService.pipe(
      Effect.provide(CheckWorktreeService.layer),
      Effect.provideService(WorktreeCatalogStore, catalog),
      Effect.provideService(
        InventoryStore,
        new InMemoryInventoryStore(options.projects ?? [project]),
      ),
      Effect.provideService(Clock.Clock, await testClock(now)),
      Effect.provideService(CheckWorktreeOptions, { staleAfterMs: MINUTE_MS }),
    ),
  );
}

const found = { kind: 'found', worktree };

describe('CheckWorktreeService', () => {
  it('answers a worktree the last refresh found, for reading', async () => {
    expect(
      Effect.runSync(
        (await service()).execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toEqual(found);
  });

  it('answers an available worktree of an available project for writing', async () => {
    expect(
      Effect.runSync(
        (await service()).execute({
          worktreeId: worktree.id,
          requireAvailableProject: true,
        }),
      ),
    ).toEqual(found);
  });

  it('still reads a worktree of a project that is unavailable', async () => {
    expect(
      Effect.runSync(
        (
          await service({ projects: [{ ...project, available: false }] })
        ).execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toEqual(found);
  });

  it('refuses to write to a worktree of a project that is unavailable', async () => {
    const checked = await service({
      projects: [{ ...project, available: false }],
    });
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: true,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose folder is unavailable', async () => {
    const checked = await service({
      catalog: [observed({}, [{ ...worktree, available: false }])],
    });
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: true,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses to write to a worktree whose project is no longer registered', async () => {
    const checked = await service({ projects: [] });
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: true,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree no fresh refresh has seen', async () => {
    const checked = await service();
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: 'unknown',
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeNotFoundError);
  });

  it('refuses an unknown worktree as unavailable while a repository could not be listed', async () => {
    const checked = await service({
      catalog: [observed({ listed: false }, [])],
    });
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: 'unknown',
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a known worktree whose repository could not be listed at the last refresh', async () => {
    const checked = await service({ catalog: [observed({ listed: false })] });
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toThrow(WorktreeUnavailableError);
  });

  it('answers a worktree inside the project the caller named', async () => {
    expect(
      Effect.runSync(
        (await service()).execute({
          worktreeId: worktree.id,
          projectId: project.id,
          requireAvailableProject: false,
        }),
      ),
    ).toEqual(found);
  });

  it('refuses a worktree that belongs to another project than the one named', async () => {
    const checked = await service();
    expect(() =>
      Effect.runSync(
        checked.execute({
          worktreeId: worktree.id,
          projectId: 'project-2',
          requireAvailableProject: true,
        }),
      ),
    ).toThrow(WorktreeNotFoundError);
  });

  it('answers stale for a worktree observed longer ago than the staleness limit', async () => {
    expect(
      Effect.runSync(
        (
          await service({
            catalog: [observed({ observedAt: '2026-09-24T11:58:59.999Z' })],
          })
        ).execute({ worktreeId: worktree.id, requireAvailableProject: false }),
      ),
    ).toEqual({ kind: 'stale' });
  });

  it('still answers a worktree observed exactly at the staleness limit', async () => {
    expect(
      Effect.runSync(
        (
          await service({
            catalog: [observed({ observedAt: '2026-09-24T11:59:00.000Z' })],
          })
        ).execute({ worktreeId: worktree.id, requireAvailableProject: false }),
      ),
    ).toEqual(found);
  });

  it('answers stale for an unknown worktree before any refresh has observed a project', async () => {
    expect(
      Effect.runSync(
        (await service({ catalog: [] })).execute({
          worktreeId: worktree.id,
          requireAvailableProject: false,
        }),
      ),
    ).toEqual({ kind: 'stale' });
  });

  it('answers stale for an unknown worktree while some observation is stale', async () => {
    expect(
      Effect.runSync(
        (
          await service({
            catalog: [observed({ observedAt: '2026-09-24T11:00:00.000Z' }, [])],
          })
        ).execute({ worktreeId: 'unknown', requireAvailableProject: false }),
      ),
    ).toEqual({ kind: 'stale' });
  });
});
