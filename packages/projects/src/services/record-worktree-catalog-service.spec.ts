import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type {
  ListedWorktree,
  RegisteredProject,
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

function record(
  catalog: InMemoryWorktreeCatalogStore,
  projects: RegisteredProject[],
  listings: {
    projectId: string;
    available: boolean;
    worktrees: ListedWorktree[];
  }[],
) {
  new RecordWorktreeCatalogService(catalog, new FixedClock(now)).execute({
    projects,
    listings: listings.map((listing) => ({ ...listing, complete: true })),
  });
}

describe('RecordWorktreeCatalogService', () => {
  it('records each listed project as observed now with the worktrees its listing found', () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    record(
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
        listed: true,
      },
    });
  });

  it('records a project whose listing failed as observed but not listed, keeping the worktrees given for it', () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    const kept = { ...worktree('main', 'api'), available: false };
    record(
      catalog,
      [project('api')],
      [{ projectId: 'api', available: false, worktrees: [kept] }],
    );
    expect(catalog.observations()).toMatchObject([
      { id: 'api', observedAt: now, listed: false },
    ]);
    expect(catalog.lastSeen({ projectId: 'api' })).toEqual([kept]);
  });

  it('forgets a project that is no longer registered', () => {
    const catalog = new InMemoryWorktreeCatalogStore();
    record(
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
    record(
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
    expect(catalog.observations().map((observation) => observation.id)).toEqual(
      ['web'],
    );
  });
});
