import { CheckProjectService } from '@porcelain/projects/services';
import { Context, Effect, Layer } from 'effect';
import type {
  ArchiveReviewRequest,
  ReviewArchivePlan,
} from '@porcelain/contracts/reviews';
import type {
  ReviewNotFoundError,
  ReviewArchiveRefusedError,
} from '@porcelain/reviews/errors';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ArchiveReviewService,
  ReadReviewRecordService,
} from '@porcelain/reviews/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { ReadReviewPullRequestUseCasePort } from '../../ports/read-review-pull-request-use-case-port.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class ArchiveReviewUseCase extends Context.Service<
  ArchiveReviewUseCase,
  {
    readonly execute: (
      input: ArchiveReviewRequest & { reviewId: string },
    ) => Effect.Effect<
      { archived: boolean; plan: ReviewArchivePlan },
      ReviewNotFoundError | ProjectNotFoundError | ReviewArchiveRefusedError
    >;
  }
>()('@porcelain/server/ArchiveReviewUseCase') {
  static readonly layer = Layer.effect(
    ArchiveReviewUseCase,
    Effect.gen(function* () {
      const archive = yield* ArchiveReviewService;
      const projects = yield* CheckProjectService;
      const reviews = yield* ReadReviewRecordService;
      const pulls = yield* ReadReviewPullRequestUseCasePort;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('ArchiveReviewUseCase.execute')(function* (input) {
          const pull = yield* pulls.execute(input);
          const record = yield* lanes.run(
            keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            'read',
            () => reviews.execute(input),
          );
          const project = yield* lanes.run(keys.inventory(), 'read', () =>
            projects.execute({ projectId: record.projectId }),
          );
          return yield* lanes.run(
            [
              keys.project(project),
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
            ],
            'write',
            () =>
              archive.execute({
                ...input,
                repositoryIdentity: project.repositoryIdentity,
                mergedHead:
                  pull.kind === 'available' &&
                  pull.pullRequest.state === 'merged'
                    ? pull.pullRequest.headSha
                    : undefined,
                pullRequestClosed:
                  pull.kind === 'available' &&
                  pull.pullRequest.state !== 'open',
              }),
            {
              succeeded: (value) =>
                value.archived ? events.inventoryChanged() : Effect.void,
            },
          );
        }),
      };
    }),
  );
}
