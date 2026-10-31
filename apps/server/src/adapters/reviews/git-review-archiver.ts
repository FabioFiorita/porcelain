import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { cleanupWorktree } from '@porcelain/git/actions';
import { ReviewArchiver } from '@porcelain/reviews/ports';
import { ReviewArchiveRefusedError } from '@porcelain/reviews/errors';
import type { Limits } from '../../config/limits.ts';
export const gitReviewArchiverLayer = (limits: Limits['git']) =>
  Layer.effect(
    ReviewArchiver,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        execute: Effect.fn('ReviewArchiver.execute')(function* (input) {
          return yield* cleanupWorktree(input, limits).pipe(
            provideGit,
            Effect.mapError(
              (error) =>
                new ReviewArchiveRefusedError({
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
