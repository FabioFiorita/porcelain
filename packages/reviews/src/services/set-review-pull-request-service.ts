import { Context, Effect, Layer } from 'effect';
import type { GitHubPullRequest } from '../models/pull-request.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewPullRequestRefusedError } from '../errors/review-pull-request-refused-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { normalizedReviewPullRequest } from '../rules/review-publication.ts';

export class SetReviewPullRequestService extends Context.Service<
  SetReviewPullRequestService,
  {
    readonly execute: (input: {
      reviewId: string;
      pullRequest: GitHubPullRequest | undefined;
    }) => Effect.Effect<
      void,
      ReviewNotFoundError | ReviewPullRequestRefusedError
    >;
  }
>()('@porcelain/reviews/SetReviewPullRequestService') {
  static readonly layer = Layer.effect(
    SetReviewPullRequestService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      return {
        execute: Effect.fn('SetReviewPullRequestService.execute')(
          function* (input) {
            const record = yield* reviews.readRecord(input);
            if (!record) return yield* new ReviewNotFoundError();
            const pull = input.pullRequest;
            if (pull && pull.headRefName !== record.branch)
              return yield* new ReviewPullRequestRefusedError({
                message: `The pull request head must be ${record.branch}.`,
              });
            const pullRequest = normalizedReviewPullRequest(pull?.url);
            const records = yield* reviews.list({
              projectId: record.projectId,
            });
            if (
              records.some(
                (other) =>
                  other.reviewId !== record.reviewId &&
                  other.state === 'open' &&
                  (pullRequest
                    ? normalizedReviewPullRequest(other.pullRequest) ===
                      pullRequest
                    : record.state === 'open' &&
                      other.branch === record.branch &&
                      other.pullRequest === undefined),
              )
            )
              return yield* new ReviewPullRequestRefusedError({
                message:
                  'Another open review already follows this pull request or branch.',
              });
            yield* reviews.setPullRequest({
              reviewId: input.reviewId,
              pullRequest,
            });
          },
        ),
      };
    }),
  );
}
