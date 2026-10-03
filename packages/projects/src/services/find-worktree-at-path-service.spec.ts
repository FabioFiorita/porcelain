import { describe, expect, it } from 'vitest';
import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import type { ProjectWorktrees } from '@porcelain/projects/models';
import { FindWorktreeAtPathService } from './find-worktree-at-path-service.ts';

const listings: ProjectWorktrees[] = [
  {
    projectId: 'project',
    available: true,
    worktrees: [
      {
        id: 'app',
        projectId: 'project',
        path: '/code/app',
        branch: 'main',
        main: true,
        available: true,
        metadataIdentity: 'metadata-app',
        administrativeDirectory: '/code/app/.git',
        commonDirectory: '/code/app/.git',
        repositoryIdentity: 'repository',
        repositoryId: 'repository',
      },
    ],
  },
];
const service = new FindWorktreeAtPathService();

describe('FindWorktreeAtPathService', () => {
  it('answers the worktree whose folder holds the path', () => {
    expect(
      service.execute({ path: '/code/app/src/index.ts', listings }),
    ).toEqual({ worktreeId: 'app' });
  });

  it('refuses a path outside every known worktree', () => {
    expect(() =>
      service.execute({ path: '/code/application', listings }),
    ).toThrow(NoWorktreeAtPathError);
  });
});
