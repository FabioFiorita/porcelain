import { Effect, Layer, FileSystem, Path } from 'effect';
import { admittedWrite } from '@porcelain/effects/worktree';
import { cleanupWorktree } from '@porcelain/git/actions';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { WorktreeCleaner } from '@porcelain/git-actions/ports';
import { WorktreeCleanupRefusedError } from '@porcelain/git-actions/errors';
import type { Limits } from '../../config/limits.ts';
export const gitWorktreeCleanerLayer = (limits: Limits['git']) =>
  Layer.effect(
    WorktreeCleaner,
    Effect.gen(function* () {
      const provide = yield* captureGitPlatform();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return {
        execute: Effect.fn('WorktreeCleaner.execute')((input) =>
          admittedWrite(input.worktree.id, (committed) =>
            Effect.gen(function* () {
              if (
                yield* fs
                  .exists(
                    path.join(input.worktree.administrativeDirectory, 'locked'),
                  )
                  .pipe(
                    Effect.mapError(
                      () =>
                        new WorktreeCleanupRefusedError({
                          message: 'The worktree lock could not be checked.',
                        }),
                    ),
                  )
              )
                return yield* new WorktreeCleanupRefusedError({
                  message:
                    'This worktree is locked. Unlock it before deleting its resources.',
                });
              const plan = yield* cleanupWorktree(
                {
                  ...input,
                  commonDirectory: input.worktree.commonDirectory,
                  repositoryIdentity: input.worktree.repositoryIdentity,
                  worktreePath: input.worktree.path,
                  branch: input.worktree.branch?.replace(/^refs\/heads\//, ''),
                },
                limits,
              ).pipe(
                provide,
                Effect.mapError(
                  (error) =>
                    new WorktreeCleanupRefusedError({
                      message:
                        error._tag === 'GitCleanupRefusedError'
                          ? error.message
                          : 'Could not inspect or delete the worktree resources. Check repository access and retry.',
                    }),
                ),
              );
              if (input.confirmation) committed();
              return plan;
            }),
          ),
        ),
      };
    }),
  );
