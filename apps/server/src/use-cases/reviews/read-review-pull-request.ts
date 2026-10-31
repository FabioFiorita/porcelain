import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Layer } from 'effect';
import type { ReadPullRequestResponse } from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ReadGitHubPullRequestService,
  ReadReviewRecordService,
} from '@porcelain/reviews/services';
import { ObserveReviewPullRequestService } from '@porcelain/reviews/services';
import { ReadReviewGitHubTargetUseCasePort } from '../../ports/read-review-github-target-use-case-port.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
export class ReadReviewPullRequestUseCase extends Context.Service<
  ReadReviewPullRequestUseCase,
  {
    readonly execute: (input: {
      reviewId: string;
    }) => Effect.Effect<
      ReadPullRequestResponse,
      ReviewNotFoundError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/ReadReviewPullRequestUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewPullRequestUseCase,
    Effect.gen(function* () {
      const target = yield* ReadReviewGitHubTargetUseCasePort;
      const events = yield* EventPublisher;
      const github = yield* ReadGitHubPullRequestService;
      const reviews = yield* ReadReviewRecordService;
      const close = yield* ObserveReviewPullRequestService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewPullRequestUseCase.execute')(
          function* (input) {
            const linked = yield* target.execute(input);
            if (linked.kind !== 'available') return linked;
            const result = yield* github
              .execute({
                ...linked.repository,
                account: linked.account,
                number: linked.number,
              })
              .pipe(Effect.result);
            if (result._tag === 'Failure')
              return {
                kind: 'unavailable',
                reason:
                  result.failure._tag === 'GitHubPullRequestNotFoundError'
                    ? 'offline'
                    : result.failure.reason,
              };
            const observed = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'write',
              () =>
                Effect.gen(function* () {
                  const current = yield* reviews.execute(input);
                  if (current.pullRequest !== linked.url) return undefined;
                  return yield* close.execute({
                    ...input,
                    pullRequest: result.success,
                  });
                }),
              {
                succeeded: (value) =>
                  value?.closedReview ? events.inventoryChanged() : Effect.void,
              },
            );
            if (!observed) return { kind: 'not-linked' as const };
            return {
              kind: 'available' as const,
              account: linked.account,
              pullRequest: observed.pullRequest,
            };
          },
        ),
      };
    }),
  );
}
