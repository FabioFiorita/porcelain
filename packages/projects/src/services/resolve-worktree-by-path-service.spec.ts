import { describe, expect, it } from 'vitest';
import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import { ResolveWorktreeByPathService } from './resolve-worktree-by-path-service.ts';

function worktree(id: string, path: string) {
  return {
    id,
    projectId: 'project',
    path,
    branch: 'main',
    main: false,
    available: true,
    metadataIdentity: `metadata-${id}`,
    administrativeDirectory: `${path}/.git`,
    commonDirectory: '/code/app/.git',
    repositoryIdentity: 'repository',
  };
}

function listing(
  ...worktrees: ReturnType<typeof worktree>[]
): ProjectWorktrees {
  return { projectId: 'project', available: true, complete: true, worktrees };
}

const listings = [
  listing(
    worktree('app', '/code/app'),
    worktree('nested', '/code/app/.worktrees/feature'),
  ),
  listing(worktree('other', '/code/application')),
];

const service = new ResolveWorktreeByPathService();

describe('ResolveWorktreeByPathService', () => {
  it('finds the worktree at its own root and anywhere below it', () => {
    expect(service.execute({ path: '/code/app', listings })).toEqual({
      worktreeId: 'app',
    });
    expect(
      service.execute({ path: '/code/app/src/index.ts', listings }),
    ).toEqual({ worktreeId: 'app' });
  });

  it('prefers the deepest worktree when one sits inside another', () => {
    expect(
      service.execute({ path: '/code/app/.worktrees/feature/src', listings }),
    ).toEqual({ worktreeId: 'nested' });
  });

  it('does not mistake a sibling that shares a name prefix for a parent', () => {
    expect(
      service.execute({ path: '/code/application/src', listings }),
    ).toEqual({ worktreeId: 'other' });
  });

  it('reads trailing slashes, repeated slashes and dot segments as the path they name', () => {
    expect(service.execute({ path: '/code//app/./src/', listings })).toEqual({
      worktreeId: 'app',
    });
    expect(
      service.execute({
        path: '/code/app/.worktrees/feature/../../src',
        listings,
      }),
    ).toEqual({ worktreeId: 'app' });
  });

  it('refuses a path that climbs out of every worktree', () => {
    expect(() =>
      service.execute({ path: '/code/app/../elsewhere', listings }),
    ).toThrow(NoWorktreeAtPathError);
  });

  it('refuses a path outside every worktree, or when nothing is registered', () => {
    expect(() => service.execute({ path: '/code', listings })).toThrow(
      NoWorktreeAtPathError,
    );
    expect(() => service.execute({ path: '/code/app', listings: [] })).toThrow(
      NoWorktreeAtPathError,
    );
  });

  it('refuses a relative path, which names no place on its own', () => {
    expect(() => service.execute({ path: 'code/app', listings })).toThrow(
      NoWorktreeAtPathError,
    );
    expect(() => service.execute({ path: '.', listings })).toThrow(
      NoWorktreeAtPathError,
    );
  });
});
