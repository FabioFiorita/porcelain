import { testClock } from '@porcelain/kernel/test-kit';
import { WorktreeCatalogStore } from '@porcelain/projects/ports';
import { Effect, Clock, Logger } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  type ListedWorktree,
  type RegisteredProject,
  type ProjectWorktrees,
} from '@porcelain/projects/models';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { RecordWorktreeCatalogService } from './record-worktree-catalog-service.ts';

const now = '2026-09-24T12:00:00.000Z';

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position: 1,
  };
}

function worktree(id: string, projectId: string): ListedWorktree {
  return {
    id,
    projectId,
    path: `/srv/${projectId}/${id}`,
    branch: 'refs/heads/main',
    main: false,
    available: true,
    metadataIdentity: `metadata-${id}`,
    administrativeDirectory: `/srv/${projectId}/.git/worktrees/${id}`,
    commonDirectory: `/srv/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
    repositoryId: `identity-${projectId}`,
  };
}

async function record(
  catalog: InMemoryWorktreeCatalogStore,
  projects: RegisteredProject[],
  listings: ProjectWorktrees[],
  logs: unknown[] = [],
) {
  Effect.runSync(
    RecordWorktreeCatalogService.use((service) =>
      service.execute({
        projects,
        listings: listings.map((listing) => ({ ...listing, complete: true })),
      }),
    ).pipe(
      Effect.provide(RecordWorktreeCatalogService.layer),
      Effect.provide(
        Logger.layer([Logger.make(({ message }) => logs.push(message))]),
      ),
      Effect.provideService(WorktreeCatalogStore, catalog),
      Effect.provideService(Clock.Clock, await testClock(now)),
    ),
  );
}

describe('RecordWorktreeCatalogService', () => {
  it('records each listed project as observed now with the worktrees its listing found', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    await record(
      catalog,
      [project('api')],
      [
        {
          projectId: 'api',
          available: true,
          worktrees: [worktree('main', 'api')],
        },
      ],
    );
    expect(catalog.find({ worktreeId: 'main' })).toEqual({
      worktree: worktree('main', 'api'),
      observation: {
        id: 'api',
        commonDirectory: '/srv/api/.git',
        repositoryIdentity: 'identity-api',
        observedAt: now,
        available: true,
      },
    });
  });

  it('records a project whose listing failed as observed but not listed, keeping the worktrees given for it', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    const kept = { ...worktree('main', 'api'), available: false };
    await record(
      catalog,
      [project('api')],
      [{ projectId: 'api', available: false, worktrees: [kept] }],
    );
    expect(catalog.listObservations()).toMatchObject([
      { id: 'api', observedAt: now, available: false },
    ]);
    expect(catalog.lastSeen({ projectId: 'api' })).toEqual([kept]);
  });

  it('forgets a project that is no longer registered', async () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    await record(
      catalog,
      [project('api'), project('web')],
      [
        {
          projectId: 'api',
          available: true,
          worktrees: [worktree('main', 'api')],
        },
        {
          projectId: 'web',
          available: true,
          worktrees: [worktree('site', 'web')],
        },
      ],
    );
    await record(
      catalog,
      [project('web')],
      [
        {
          projectId: 'web',
          available: true,
          worktrees: [worktree('site', 'web')],
        },
      ],
    );
    expect(catalog.find({ worktreeId: 'main' })).toBeUndefined();
    expect(
      catalog.listObservations().map((observation) => observation.id),
    ).toEqual(['web']);
  });
});

it('logs each availability or reason change once, including recovery', async () => {
  const catalog = new InMemoryWorktreeCatalogStore();
  const logs: unknown[] = [];
  const projects = [project('api')];
  const observe = (
    available: boolean,
    unavailableReason?: 'missing' | 'permission' | 'moved' | 'git-failed',
  ) =>
    record(
      catalog,
      projects,
      [
        {
          projectId: 'api',
          ...(available
            ? { available: true as const }
            : { available: false as const, unavailableReason }),
          worktrees: [],
        },
      ],
      logs,
    );
  await observe(true);
  await observe(false, 'missing');
  await observe(false, 'missing');
  await observe(false, 'permission');
  await observe(false, 'permission');
  await observe(false, 'moved');
  await observe(false, 'moved');
  await observe(false, 'git-failed');
  await observe(false, 'git-failed');
  await observe(true);
  await observe(true);
  expect(logs).toEqual([
    [
      'Repository availability changed',
      { projectId: 'api', available: false, reason: 'missing' },
    ],
    [
      'Repository availability changed',
      { projectId: 'api', available: false, reason: 'permission' },
    ],
    [
      'Repository availability changed',
      { projectId: 'api', available: false, reason: 'moved' },
    ],
    [
      'Repository availability changed',
      { projectId: 'api', available: false, reason: 'git-failed' },
    ],
    [
      'Repository availability changed',
      { projectId: 'api', available: true, reason: undefined },
    ],
  ]);
});
