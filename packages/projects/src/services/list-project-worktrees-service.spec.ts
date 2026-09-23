import { describe, expect, it } from 'vitest';
import type { Worktree } from '@porcelain/projects/models';
import { ScriptedProjectWorktreeReader } from '../../spec/fakes/scripted-project-worktree-reader.ts';
import { ListProjectWorktreesService } from './list-project-worktrees-service.ts';

const project = {
  id: 'project-1',
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
};

function worktree(id: string, available = true): Worktree {
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
  };
}

function service(reader: ScriptedProjectWorktreeReader) {
  return new ListProjectWorktreesService(reader);
}

describe('ListProjectWorktreesService', () => {
  it('reports a listed project as available and complete', async () => {
    const reader = new ScriptedProjectWorktreeReader();
    reader.answer({
      projectId: project.id,
      outcome: 'listed',
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
    const reader = new ScriptedProjectWorktreeReader();
    reader.answer({
      projectId: project.id,
      outcome: 'listed',
      worktrees: [worktree('main')],
      unidentified: 1,
    });
    const result = await service(reader).execute({ project });
    expect(result.available).toBe(true);
    expect(result.complete).toBe(false);
  });

  it.each(['unavailable', 'timed-out', 'moved'] as const)(
    'shows the last seen worktrees as unavailable when the listing is %s',
    async (outcome) => {
      const reader = new ScriptedProjectWorktreeReader();
      reader.answer({
        projectId: project.id,
        outcome,
        lastSeen: [worktree('main'), worktree('feature')],
      });
      expect(await service(reader).execute({ project })).toEqual({
        projectId: project.id,
        available: false,
        complete: false,
        worktrees: [worktree('main', false), worktree('feature', false)],
      });
    },
  );

  it('reports an unlisted project with nothing seen before as empty', async () => {
    const reader = new ScriptedProjectWorktreeReader();
    reader.answer({
      projectId: project.id,
      outcome: 'unavailable',
      lastSeen: [],
    });
    expect((await service(reader).execute({ project })).worktrees).toEqual([]);
  });
});
