import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { listWorktrees, readOriginUrl } from '@porcelain/git/discovery';
import { repositoryUnavailableReason } from '@porcelain/git/errors';
import { RepositoryInspectionFailedError } from '@porcelain/projects/errors';
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
            provideGit,
            Effect.mapError((error) => {
              const reason = repositoryUnavailableReason(error);
              return new RepositoryInspectionFailedError({
                message:
                  reason === 'missing'
                    ? `The folder no longer exists: ${input.path}`
                    : reason === 'permission'
                      ? `Porcelain cannot read this folder. Check its access permissions: ${input.path}`
                      : `Git could not inspect this folder. Check that it is a readable Git repository: ${input.path}`,
              });
            }),
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
