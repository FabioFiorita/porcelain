import { describe, expect, it } from 'vitest';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import { worktreeAtPath } from './worktree-at-path.ts';

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
    repositoryId: 'repository',
  };
}

function listing(
  ...worktrees: ReturnType<typeof worktree>[]
): ProjectWorktrees {
  return { projectId: 'project', available: true, worktrees };
}

const listings = [
  listing(
    worktree('app', '/code/app'),
    worktree('nested', '/code/app/.worktrees/feature'),
  ),
  listing(worktree('other', '/code/application')),
];

describe('worktreeAtPath', () => {
  it('finds the worktree at its own root and anywhere below it', () => {
    expect(worktreeAtPath('/code/app', listings)).toBe('app');
    expect(worktreeAtPath('/code/app/src/index.ts', listings)).toBe('app');
  });

  it('prefers the deepest worktree when one sits inside another', () => {
    expect(worktreeAtPath('/code/app/.worktrees/feature/src', listings)).toBe(
      'nested',
    );
  });

  it('does not mistake a sibling that shares a name prefix for a parent', () => {
    expect(worktreeAtPath('/code/application/src', listings)).toBe('other');
  });

  it('reads trailing slashes, repeated slashes and dot segments as the path they name', () => {
    expect(worktreeAtPath('/code//app/./src/', listings)).toBe('app');
    expect(
      worktreeAtPath('/code/app/.worktrees/feature/../../src', listings),
    ).toBe('app');
  });

  it('finds nothing for a path that climbs out of every worktree, and the worktree a climbing path lands back in', () => {
    expect(worktreeAtPath('/code/app/../elsewhere', listings)).toBeUndefined();
    expect(worktreeAtPath('/code/elsewhere/../app/src', listings)).toBe('app');
  });

  it('finds nothing outside every worktree, or when nothing is registered', () => {
    expect(worktreeAtPath('/code', listings)).toBeUndefined();
    expect(worktreeAtPath('/code/app', [])).toBeUndefined();
    expect(worktreeAtPath('/code/app', listings)).toBe('app');
  });

  it('finds nothing for a relative path, which names no place on its own, though its absolute form names a worktree', () => {
    expect(worktreeAtPath('code/app', listings)).toBeUndefined();
    expect(worktreeAtPath('.', listings)).toBeUndefined();
    expect(worktreeAtPath('/code/app', listings)).toBe('app');
  });
});
