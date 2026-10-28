import type { GitHubPullRequest } from '@porcelain/reviews/models';
import { Context, Effect, Layer } from 'effect';
import type {
  ReviewParams,
  SetReviewPullRequestRequest,
  SetReviewPullRequestResponse,
} from '@porcelain/contracts/reviews';
import type {
  ReviewNotFoundError,
  ReviewPullRequestRefusedError,
} from '@porcelain/reviews/errors';
import { ReviewPullRequestRefusedError as Refused } from '@porcelain/reviews/errors';
import { CheckProjectService } from '@porcelain/projects/services';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ReadGitHubPullRequestService,
  ReadReviewRecordService,
  SetReviewPullRequestService,
} from '@porcelain/reviews/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';

export class SetReviewPullRequestUseCase extends Context.Service<
  SetReviewPullRequestUseCase,
  {
    readonly execute: (
      input: ReviewParams & SetReviewPullRequestRequest,
    ) => Effect.Effect<
      SetReviewPullRequestResponse,
      ReviewNotFoundError | ProjectNotFoundError | ReviewPullRequestRefusedError
    >;
  }
>()('@porcelain/server/SetReviewPullRequestUseCase') {
  static readonly layer = Layer.effect(
    SetReviewPullRequestUseCase,
    Effect.gen(function* () {
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const reviews = yield* ReadReviewRecordService;
      const projects = yield* CheckProjectService;
      const github = yield* ReadGitHubPullRequestService;
      const operation = yield* SetReviewPullRequestService;
      const events = yield* EventPublisher;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('SetReviewPullRequestUseCase.execute')(
          function* (input) {
            const record = yield* lanes.run(
              keys.reviews({ repositoryId: `review:${input.reviewId}` }),
              'read',
              () => reviews.execute(input),
            );
            const project = yield* projects
              .execute({ projectId: record.projectId })
              .pipe(
                Effect.catchTag('ProjectNotFoundError', () =>
                  Effect.succeed(undefined),
                ),
              );

            let pullRequest: GitHubPullRequest | undefined;
            if (input.pullRequest !== undefined) {
              const { repository, selection } = yield* resolve.execute({
                projectId: record.projectId,
              });
              if (selection.unavailable) return selection.unavailable;
              if (!repository || !selection.choice)
                return {
                  kind: 'unavailable' as const,
                  reason: 'not-github' as const,
                };
              const url = new URL(input.pullRequest);
              const number = Number(url.pathname.split('/')[4]);
              if (
                url.pathname.toLowerCase() !==
                `/${repository.owner}/${repository.repo}/pull/${number}`.toLowerCase()
              )
                return yield* new Refused({
                  message: 'The pull request repository must match origin.',
                });
              const result = yield* github
                .execute({
                  ...repository,
                  account: selection.choice.account,
                  number,
                })
                .pipe(Effect.result);
              if (result._tag === 'Failure') {
                if (result.failure._tag === 'GitHubPullRequestNotFoundError')
                  return yield* new Refused({
                    message: `GitHub has no pull request #${number} in ${repository.owner}/${repository.repo}.`,
                  });
                return {
                  kind: 'unavailable' as const,
                  reason: result.failure.reason,
                };
              }
              pullRequest = { ...result.success, url: input.pullRequest };
            }
            yield* lanes.run(
              [
                keys.reviews({ repositoryId: `review:${input.reviewId}` }),
                keys.reviews({
                  repositoryId:
                    project?.repositoryIdentity ?? `review:${input.reviewId}`,
                }),
              ],
              'write',
              () =>
                operation.execute({ reviewId: input.reviewId, pullRequest }),
              { succeeded: () => events.inventoryChanged() },
            );
            return { kind: 'updated' as const };
          },
        ),
      };
    }),
  );
}
