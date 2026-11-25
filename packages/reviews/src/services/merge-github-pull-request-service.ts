import { Context, Effect, Layer } from 'effect';
import type {
  GitHubRepository,
  PullRequestMergeMethod,
} from '../models/pull-request.ts';
import { PullRequestMergeRefusedError } from '../errors/pull-request-merge-refused-error.ts';
import { GitHubPullRequestMerger } from '../ports/github-pull-request-merger.ts';

type MergeTarget =
  | {
      readonly kind: 'available';
      readonly repository: GitHubRepository;
      readonly account: string;
      readonly number: number;
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: PullRequestMergeRefusedError['reason'];
    };

export class MergeGitHubPullRequestService extends Context.Service<
  MergeGitHubPullRequestService,
  {
    readonly execute: (input: {
      target: MergeTarget;
      method: PullRequestMergeMethod;
      headSha: string;
    }) => Effect.Effect<void, PullRequestMergeRefusedError>;
  }
>()('@porcelain/reviews/MergeGitHubPullRequestService') {
  static readonly layer = Layer.effect(
    MergeGitHubPullRequestService,
    Effect.gen(function* () {
      const github = yield* GitHubPullRequestMerger;
      return {
        execute: Effect.fn('MergeGitHubPullRequestService.execute')(function* ({
          target,
          method,
          headSha,
        }) {
          if (target.kind === 'unavailable')
            return yield* new PullRequestMergeRefusedError({
              reason: target.reason,
            });
          yield* github.merge({
            ...target.repository,
            account: target.account,
            number: target.number,
            method,
            headSha,
          });
        }),
      };
    }),
  );
}
