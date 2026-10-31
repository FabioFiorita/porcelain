import type { ReviewGitHubTarget } from '../../ports/read-review-github-target-use-case-port.ts';
import type { ReviewParams } from '@porcelain/contracts/reviews';
import type { ReviewNotFoundError } from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { Context, Effect, Layer } from 'effect';
import { ReadReviewRecordService } from '@porcelain/reviews/services';
import { reviewPullRequestNumber } from '@porcelain/reviews/rules';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
export class ReadReviewGitHubTargetUseCase extends Context.Service<
  ReadReviewGitHubTargetUseCase,
  {
    readonly execute: (
      input: ReviewParams,
    ) => Effect.Effect<
      ReviewGitHubTarget,
      ReviewNotFoundError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/ReadReviewGitHubTargetUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewGitHubTargetUseCase,
    Effect.gen(function* () {
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const reviews = yield* ReadReviewRecordService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ReadReviewGitHubTargetUseCase.execute')(
          function* (input) {
            const record = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'read',
              () => reviews.execute(input),
            );
            if (!record.pullRequest) return { kind: 'not-linked' };
            const { repository, selection } = yield* resolve.execute({
              projectId: record.projectId,
            });
            if (selection.unavailable) return selection.unavailable;
            if (!repository || !selection.choice)
              return { kind: 'unavailable', reason: 'not-github' };
            const number = reviewPullRequestNumber(record.pullRequest);
            const url = URL.parse(record.pullRequest);
            if (
              !number ||
              url?.hostname !== 'github.com' ||
              url.pathname.toLowerCase() !==
                `/${repository.owner}/${repository.repo}/pull/${number}`.toLowerCase()
            )
              return { kind: 'unavailable', reason: 'not-github' };
            return {
              kind: 'available',
              repository,
              account: selection.choice.account,
              number,
              url: record.pullRequest,
            };
          },
        ),
      };
    }),
  );
}
