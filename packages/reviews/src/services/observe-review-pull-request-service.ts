import { Context, Effect, Layer } from 'effect';
import type { GitHubPullRequest, PullRequest } from '../models/pull-request.ts';
import { ReviewNotFoundError } from '../errors/review-not-found-error.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { SetReviewStateService } from './set-review-state-service.ts';
import { mapPullRequest } from '../rules/pull-request.ts';
export class ObserveReviewPullRequestService extends Context.Service<
  ObserveReviewPullRequestService,
  {
    readonly execute: (input: {
      reviewId: string;
      pullRequest: GitHubPullRequest;
    }) => Effect.Effect<
      { pullRequest: PullRequest; closedReview: boolean },
      ReviewNotFoundError
    >;
  }
>()('@porcelain/reviews/ObserveReviewPullRequestService') {
  static readonly layer = Layer.effect(
    ObserveReviewPullRequestService,
    Effect.gen(function* () {
      const reviews = yield* ReviewStore;
      const close = yield* SetReviewStateService;
      return {
        execute: Effect.fn('ObserveReviewPullRequestService.execute')(
          function* (input) {
            const latest = yield* reviews.read(input);
            if (latest === undefined) return yield* new ReviewNotFoundError();
            const pullRequest = mapPullRequest(
              input.pullRequest,
              latest.headOid,
            );
            const record = yield* reviews.readRecord(input);
            if (record === undefined) return yield* new ReviewNotFoundError();
            const closedReview =
              pullRequest.state !== 'open' && record.state === 'open';
            if (closedReview)
              yield* close.execute({
                reviewId: input.reviewId,
                state: 'closed',
              });
            return { pullRequest, closedReview };
          },
        ),
      };
    }),
  );
}
