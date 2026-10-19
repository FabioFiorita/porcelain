import { Context, Effect, Layer } from 'effect';
import type { ReviewPublicationInput } from '../models/review-management.ts';
import type { ReviewCommit } from '../models/review.ts';
import { ReviewPublishRefusedError } from '../errors/review-publish-refused-error.ts';
import { reviewPublicationProblem } from '../rules/review-publication.ts';

export class ValidateReviewPublicationService extends Context.Service<
  ValidateReviewPublicationService,
  {
    readonly execute: (
      input: ReviewPublicationInput,
    ) => Effect.Effect<ReviewCommit, ReviewPublishRefusedError>;
  }
>()('@porcelain/reviews/ValidateReviewPublicationService') {
  static readonly layer = Layer.effect(
    ValidateReviewPublicationService,
    Effect.sync(() => ({
      execute: Effect.fn('ValidateReviewPublicationService.execute')(
        function* (input) {
          switch (input.status.kind) {
            case 'unborn':
              return yield* new ReviewPublishRefusedError({
                message:
                  'Commit first: HEAD is not a commit. Create a commit on a branch, then publish.',
              });
            case 'detached':
              return yield* new ReviewPublishRefusedError({
                message:
                  'Check out a branch first: HEAD is detached. Switch to the branch being reviewed, then publish.',
              });
            case 'base-unavailable':
              return yield* new ReviewPublishRefusedError({
                message:
                  'Choose a base branch with a shared history. Pass base, or configure the repository default branch, then publish.',
              });
            case 'ready':
              break;
          }
          const problem = reviewPublicationProblem({
            ...input,
            deletedPaths: input.status.commit.files
              .filter((file) => file.status === 'deleted')
              .flatMap((file) =>
                file.oldPath === undefined ? [] : [file.oldPath],
              ),
          });
          if (problem !== undefined)
            return yield* new ReviewPublishRefusedError({ message: problem });
          return input.status.commit;
        },
      ),
    })),
  );
}
