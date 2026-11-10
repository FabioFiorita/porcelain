import { EventPublisher } from '../../ports/event-publisher.ts';
import { CacheWalkthroughPullTitlesService } from '@porcelain/walkthroughs/services';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { recentPullRequestCutoff } from '@porcelain/reviews/rules';
import { Context, Effect, Layer, Clock } from 'effect';
import type {
  ProjectParams,
  ListPullRequestsResponse,
} from '@porcelain/contracts/projects';
import type { ProjectNotFoundError } from '@porcelain/projects/errors';
import { ListGitHubPullRequestsService } from '@porcelain/reviews/services';
import { mapPullRequestSummary } from '@porcelain/reviews/rules';
import { ResolveProjectGitHubUseCasePort } from '../../ports/resolve-project-github-use-case-port.ts';

export class ListProjectPullRequestsUseCase extends Context.Service<
  ListProjectPullRequestsUseCase,
  {
    readonly execute: (
      input: ProjectParams,
    ) => Effect.Effect<ListPullRequestsResponse, ProjectNotFoundError>;
  }
>()('@porcelain/server/ListProjectPullRequestsUseCase') {
  static readonly layer = Layer.effect(
    ListProjectPullRequestsUseCase,
    Effect.gen(function* () {
      const events = yield* EventPublisher;
      const walkthroughs = yield* CacheWalkthroughPullTitlesService;
      const resolve = yield* ResolveProjectGitHubUseCasePort;
      const github = yield* ListGitHubPullRequestsService;
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
            const recentlyClosedSince = recentPullRequestCutoff(
              yield* Clock.currentTimeMillis,
            );
            const pullRequests = [
              ...result.success.open,
              ...result.success.recent.filter(
                (pr) => pr.updatedAt >= recentlyClosedSince,
              ),
            ].map(mapPullRequestSummary);
            const changed = yield* lanes.run(keys.walkthroughs(), 'write', () =>
              walkthroughs.execute({
                projectId: input.projectId,
                pulls: pullRequests.map((pull) => ({
                  branch: pull.headBranch,
                  title: pull.title,
                })),
              }),
            );
            if (changed) yield* events.inventoryChanged();
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
