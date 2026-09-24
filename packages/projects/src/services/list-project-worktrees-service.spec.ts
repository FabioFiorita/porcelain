import { describe, expect, it } from 'vitest';
import type { ListedWorktree } from '@porcelain/projects/models';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { ScriptedWorktreeListingReader } from '../../spec/fakes/scripted-worktree-listing-reader.ts';
import { ListProjectWorktreesService } from './list-project-worktrees-service.ts';

const project = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
};

function worktree(id: string, available = true): ListedWorktree {
  return {
    id,
    projectId: project.id,
    path: `/srv/${id}`,
    branch: 'refs/heads/main',
    main: id === 'main',
    available,
    metadataIdentity: `metadata-${id}`,
    administrativeDirectory: `/srv/api/.git/worktrees/${id}`,
    commonDirectory: project.commonDirectory,
    repositoryIdentity: project.repositoryIdentity,
    repositoryId: project.repositoryIdentity,
  };
}

function service(
  reader: ScriptedWorktreeListingReader,
  catalog = new InMemoryWorktreeCatalogStore(),
) {
  return new ListProjectWorktreesService(reader, catalog);
}

function seen(worktrees: ListedWorktree[]) {
  const catalog = new InMemoryWorktreeCatalogStore();
  catalog.save({
    projects: [
      {
        observation: {
          ...project,
          observedAt: '2026-09-24T12:00:00.000Z',
          listed: true,
        },
        worktrees,
      },
    ],
  });
  return catalog;
}

describe('ListProjectWorktreesService', () => {
  it('reports a listed project as available and complete', async () => {
    const reader = new ScriptedWorktreeListingReader();
    reader.answer({
      kind: 'listed',
      projectId: project.id,
      repositoryIdentity: project.repositoryIdentity,
      worktrees: [worktree('main')],
      unidentified: 0,
    });
    expect(await service(reader).execute({ project })).toEqual({
      projectId: project.id,
      available: true,
      complete: true,
      worktrees: [worktree('main')],
    });
  });

  it('keeps a listing with unidentified worktrees available but incomplete', async () => {
    const reader = new ScriptedWorktreeListingReader();
    reader.answer({
      kind: 'listed',
      projectId: project.id,
      repositoryIdentity: project.repositoryIdentity,
      worktrees: [worktree('main')],
      unidentified: 1,
    });
    const result = await service(reader).execute({ project });
    expect(result.available).toBe(true);
    expect(result.complete).toBe(false);
  });

  it.each(['unavailable', 'timed-out'] as const)(
    'shows the last seen worktrees as unavailable when the listing is %s',
    async (kind) => {
      const reader = new ScriptedWorktreeListingReader();
      reader.answer({ kind, projectId: project.id });
      const catalog = seen([worktree('main'), worktree('feature')]);
      expect(await service(reader, catalog).execute({ project })).toEqual({
        projectId: project.id,
        available: false,
        complete: false,
        worktrees: [worktree('main', false), worktree('feature', false)],
      });
    },
  );

  it('shows the last seen worktrees as unavailable when the folder now holds another repository', async () => {
    const reader = new ScriptedWorktreeListingReader();
    reader.answer({
      kind: 'listed',
      projectId: project.id,
      repositoryIdentity: 'identity-2',
      worktrees: [worktree('main')],
      unidentified: 0,
    });
    const catalog = seen([worktree('main')]);
    expect(await service(reader, catalog).execute({ project })).toEqual({
      projectId: project.id,
      available: false,
      complete: false,
      worktrees: [worktree('main', false)],
    });
  });

  it('reports an unlisted project with nothing seen before as empty', async () => {
    const reader = new ScriptedWorktreeListingReader();
    reader.answer({ kind: 'unavailable', projectId: project.id });
    expect((await service(reader).execute({ project })).worktrees).toEqual([]);
  });
});
