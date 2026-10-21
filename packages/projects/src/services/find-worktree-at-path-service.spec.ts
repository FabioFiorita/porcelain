import { NoWorktreeAtPathError } from '@porcelain/projects/errors';
import { type ProjectWorktrees } from '@porcelain/projects/models';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
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
const service = Effect.runSync(
  FindWorktreeAtPathService.pipe(
    Effect.provide(FindWorktreeAtPathService.layer),
  ),
);

describe('FindWorktreeAtPathService', () => {
  it('refuses a path outside every known worktree', () => {
    expect(() =>
      Effect.runSync(service.execute({ path: '/code/application', listings })),
    ).toThrow(NoWorktreeAtPathError);
  });
});
