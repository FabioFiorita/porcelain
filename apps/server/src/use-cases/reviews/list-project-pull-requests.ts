import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { recentPullRequestCutoff } from '@porcelain/reviews/rules';
import { Context, Effect, Layer, Clock } from 'effect';
import type {
  ProjectReviewParams,
  ListPullRequestsResponse,
} from '@porcelain/contracts/reviews';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import {
  ListGitHubPullRequestsService,
  ListProjectReviewsService,
} from '@porcelain/reviews/services';
import { mapPullRequestSummary } from '@porcelain/reviews/rules';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';

export class ListProjectPullRequestsUseCase extends Context.Service<
  ListProjectPullRequestsUseCase,
  {
    readonly execute: (
      input: ProjectReviewParams,
    ) => Effect.Effect<ListPullRequestsResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ListProjectPullRequestsUseCase') {
  static readonly layer = Layer.effect(
    ListProjectPullRequestsUseCase,
    Effect.gen(function* () {
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const github = yield* ListGitHubPullRequestsService;
      const reviews = yield* ListProjectReviewsService;
      const lanes = yield* Lanes;
      const keys = yield* LaneKeys;
      return {
        execute: Effect.fn('ListProjectPullRequestsUseCase.execute')(
          function* (input) {
            const { repository, selection } = yield* resolve.execute(input);
            if (selection.unavailable !== undefined)
              return selection.unavailable;
            if (repository === undefined || selection.choice === undefined)
              return { kind: 'unavailable', reason: 'not-github' };
            const result = yield* github
              .execute({ ...repository, account: selection.choice.account })
              .pipe(Effect.result);
            if (result._tag === 'Failure')
              return { kind: 'unavailable', reason: result.failure.reason };
            const records = yield* lanes.run(
              keys.reviews({
                repositoryId: `project-reviews:${input.projectId}`,
              }),
              'read',
              () => reviews.execute(input),
            );
            const recentlyClosedSince = recentPullRequestCutoff(
              yield* Clock.currentTimeMillis,
            );
            const pullRequests = [
              ...result.success.open,
              ...result.success.recent.filter(
                (pr) => pr.updatedAt >= recentlyClosedSince,
              ),
            ].map((pr) => ({
              ...mapPullRequestSummary(pr),
              reviewId:
                records.find(
                  (record) =>
                    record.pullRequest?.toLowerCase() === pr.url.toLowerCase(),
                )?.reviewId ?? undefined,
            }));
            return {
              kind: 'available',
              account: selection.choice.account,
              pullRequests,
              truncated: result.success.truncated,
              recentlyClosedSince,
            };
          },
        ),
      };
    }),
  );
}
