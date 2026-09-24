import { describe, expect, it } from 'vitest';
import type {
  ListedWorktree,
  RegisteredProject,
} from '@porcelain/projects/models';
import { ScriptedProjectWorktreeReader } from '../../spec/fakes/scripted-project-worktree-reader.ts';
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

describe('ListKnownWorktreesService', () => {
  it('answers the worktrees last seen for each project, in the order given', () => {
    const reader = new ScriptedProjectWorktreeReader();
    reader.saw('api', [worktree('api-main', 'api')]);
    reader.saw('web', [worktree('web-main', 'web', false)]);
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
    const reader = new ScriptedProjectWorktreeReader();
    reader.saw('api', [worktree('api-main', 'api')]);
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
    const reader = new ScriptedProjectWorktreeReader();
    expect(
      new ListKnownWorktreesService(reader).execute({
        projects: [project('api', true)],
      }).listings[0]?.worktrees,
    ).toEqual([]);
  });
});
