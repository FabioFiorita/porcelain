import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { listWorktrees, readOriginUrl } from '@porcelain/git/discovery';
import { isRepositoryUnavailable } from '@porcelain/git/errors';
import type { RepositoryLocation } from '@porcelain/projects/models';
import { ProjectRepositoryReader } from '@porcelain/projects/ports';
import type { Limits } from '../../config/limits.ts';

export const gitProjectRepositoryReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    ProjectRepositoryReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        find: Effect.fn('GitProjectRepositoryReader.find')(function* (
          input: RepositoryLocation,
        ) {
          const repository = yield* listWorktrees(input.path, limits).pipe(
            Effect.catchIf(isRepositoryUnavailable, () =>
              Effect.succeed(undefined),
            ),
            provideGit,
            Effect.orDie,
          );
          if (!repository) return undefined;
          return {
            commonDirectory: repository.commonDirectory,
            repositoryIdentity: repository.repositoryIdentity,
            worktrees: repository.worktrees.map((worktree) => ({
              path: worktree.path,
              main: worktree.main,
              available: worktree.available,
            })),
          };
        }),
        readOriginUrl: Effect.fn('GitProjectRepositoryReader.readOriginUrl')(
          (input: RepositoryLocation) =>
            readOriginUrl(input.path, limits).pipe(provideGit, Effect.orDie),
        ),
      };
    }),
  );
