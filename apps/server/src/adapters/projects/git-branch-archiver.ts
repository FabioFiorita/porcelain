import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { cleanupWorktree } from '@porcelain/git/actions';
import { BranchArchiver } from '@porcelain/projects/ports';
import { BranchArchiveRefusedError } from '@porcelain/projects/errors';
import type { Limits } from '../../config/limits.ts';
export const gitBranchArchiverLayer = (limits: Limits['git']) =>
  Layer.effect(
    BranchArchiver,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        execute: Effect.fn('BranchArchiver.execute')(function* (input) {
          return yield* cleanupWorktree(input, limits).pipe(
            provideGit,
            Effect.mapError(
              (error) =>
                new BranchArchiveRefusedError({
                  message:
                    error._tag === 'GitCleanupRefusedError'
                      ? error.message
                      : 'Could not inspect the worktree and branches. Nothing was deleted. Check repository access and try again.',
                }),
            ),
          );
        }),
      };
    }),
  );
