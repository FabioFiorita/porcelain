import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { ListKnownWorktreesService } from './list-known-worktrees-service.ts';

function project(id: string, available: boolean): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available,
    position: 1,
  };
}

function worktree(
  id: string,
  projectId: string,
  available = true,
): ListedWorktree {
  return {
    id,
    projectId,
    path: `/srv/${id}`,
    branch: 'refs/heads/main',
    main: false,
    available,
    metadataIdentity: `metadata-${id}`,
    administrativeDirectory: `/srv/${projectId}/.git/worktrees/${id}`,
    commonDirectory: `/srv/${projectId}/.git`,
    repositoryIdentity: `identity-${projectId}`,
    repositoryId: `identity-${projectId}`,
  };
}

function catalog(seen: Record<string, ListedWorktree[]>) {
  const store = new InMemoryWorktreeCatalogStore();
  store.save({
    projects: Object.entries(seen).map(([id, worktrees]) => ({
      observation: {
        id,
        commonDirectory: `/srv/${id}/.git`,
        repositoryIdentity: `identity-${id}`,
        observedAt: '2026-09-24T12:00:00.000Z',
        listed: true,
      },
      worktrees,
    })),
  });
  return store;
}

describe('ListKnownWorktreesService', () => {
  it('answers the worktrees last seen for each project, in the order given', () => {
    const reader = catalog({
      api: [worktree('api-main', 'api')],
      web: [worktree('web-main', 'web', false)],
    });
    expect(
      new ListKnownWorktreesService(reader).execute({
        projects: [project('web', true), project('api', true)],
      }),
    ).toEqual({
      listings: [
        {
          projectId: 'web',
          available: true,
          worktrees: [worktree('web-main', 'web', false)],
        },
        {
          projectId: 'api',
          available: true,
          worktrees: [worktree('api-main', 'api')],
        },
      ],
    });
  });

  it('shows every worktree of an unavailable project as unavailable', () => {
    const reader = catalog({ api: [worktree('api-main', 'api')] });
    expect(
      new ListKnownWorktreesService(reader).execute({
        projects: [project('api', false)],
      }),
    ).toEqual({
      listings: [
        {
          projectId: 'api',
          available: false,
          worktrees: [worktree('api-main', 'api', false)],
        },
      ],
    });
  });

  it('answers an empty list for a project never listed', () => {
    const reader = catalog({});
    expect(
      new ListKnownWorktreesService(reader).execute({
        projects: [project('api', true)],
      }).listings[0]?.worktrees,
    ).toEqual([]);
  });
});
