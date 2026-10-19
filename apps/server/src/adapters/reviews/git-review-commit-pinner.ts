import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { pinReviewRevision } from '@porcelain/git/inspection';
import { ReviewCommitPinner } from '@porcelain/reviews/ports';
import { ReviewPublishRefusedError } from '@porcelain/reviews/errors';
import type { Limits } from '../../config/limits.ts';

export const gitReviewCommitPinnerLayer = (limits: Limits['git']) =>
  Layer.effect(
    ReviewCommitPinner,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        pin: Effect.fn('ReviewCommitPinner.pin')(function* (input) {
          yield* pinReviewRevision(input.commonDirectory, input, limits).pipe(
            provideGit,
            Effect.mapError(
              () =>
                new ReviewPublishRefusedError({
                  message:
                    'Could not retain this revision. Read the latest revision and retry; check that the project repository is available.',
                }),
            ),
          );
        }),
      };
    }),
  );
