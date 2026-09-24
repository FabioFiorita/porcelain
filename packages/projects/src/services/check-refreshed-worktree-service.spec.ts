import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import { WorktreeUnavailableError } from '@porcelain/projects/errors';
import type {
  CatalogProject,
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
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

function service(observedAt: string, worktrees: ListedWorktree[] = [worktree]) {
  const snapshot: CatalogProject = {
    observation: {
      id: project.id,
      commonDirectory: project.commonDirectory,
      repositoryIdentity: project.repositoryIdentity,
      observedAt,
      listed: true,
    },
    worktrees,
  };
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({ projects: [snapshot] });
  return new CheckRefreshedWorktreeService(
    catalog,
    new InMemoryInventoryStore([project]),
    new FixedClock('2026-09-24T12:00:00.000Z'),
    { staleAfterMs: 60 * 1000 },
  );
}

describe('CheckRefreshedWorktreeService', () => {
  it('answers the worktree the refresh just found', () => {
    expect(
      service('2026-09-24T12:00:00.000Z').execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toEqual(worktree);
  });

  it('refuses a worktree the refresh did not observe as unavailable instead of asking for another refresh', () => {
    expect(() =>
      service('2026-09-24T11:00:00.000Z').execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toThrow(WorktreeUnavailableError);
  });

  it('refuses a worktree the refresh did not find', () => {
    expect(() =>
      service('2026-09-24T12:00:00.000Z', []).execute({
        worktreeId: worktree.id,
        purpose: 'reading',
      }),
    ).toThrow(WorktreeNotFoundError);
  });
});
