import { EventPublisher } from '../../ports/event-publisher.ts';
import { Context, Effect, Exit, Layer } from 'effect';
import type { ReadPullRequestResponse } from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ReadGitHubPullRequestService,
  ReadReviewRecordService,
} from '@porcelain/reviews/services';
import { ObserveReviewPullRequestService } from '@porcelain/reviews/services';
import { reviewPullRequestNumber } from '@porcelain/reviews/rules';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
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
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const events = yield* EventPublisher;
      const github = yield* ReadGitHubPullRequestService;
      const reviews = yield* ReadReviewRecordService;
      const close = yield* ObserveReviewPullRequestService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewPullRequestUseCase.execute')(
          function* (input) {
            const record = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'read',
              () => reviews.execute(input),
            );
            if (record.pullRequest === undefined) return { kind: 'not-linked' };
            const { repository, selection } = yield* resolve.execute({
              projectId: record.projectId,
            });
            if (selection.unavailable !== undefined)
              return selection.unavailable;
            if (repository === undefined || selection.choice === undefined)
              return { kind: 'unavailable', reason: 'not-github' };
            const number = reviewPullRequestNumber(record.pullRequest);
            const url = URL.parse(record.pullRequest);
            if (
              number === undefined ||
              url?.hostname !== 'github.com' ||
              url.pathname.toLowerCase() !==
                `/${repository.owner}/${repository.repo}/pull/${number}`.toLowerCase()
            )
              return { kind: 'unavailable', reason: 'not-github' };
            const result = yield* github
              .execute({
                ...repository,
                account: selection.choice.account,
                number,
              })
              .pipe(Effect.result);
            if (result._tag === 'Failure')
              return { kind: 'unavailable', reason: result.failure.reason };
            const observed = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'write',
              () => close.execute({ ...input, pullRequest: result.success }),
              {
                settled: (exit) =>
                  Exit.isSuccess(exit) && exit.value.closedReview
                    ? events.inventoryChanged()
                    : Effect.void,
              },
            );
            return {
              kind: 'available' as const,
              account: selection.choice?.account ?? '',
              pullRequest: observed.pullRequest,
            };
          },
        ),
      };
    }),
  );
}
