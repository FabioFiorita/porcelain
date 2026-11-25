import { Context, Effect, Layer } from 'effect';
import { PullRequestActionRefusedError } from '../errors/pull-request-action-refused-error.ts';
import { GitHubPullRequestActions } from '../ports/github-pull-request-actions.ts';
import type { GitHubWriteTarget } from './rerun-github-checks-service.ts';

export class CommentOnGitHubPullRequestService extends Context.Service<
  CommentOnGitHubPullRequestService,
  {
    readonly execute: (input: {
      target: GitHubWriteTarget;
      body: string;
    }) => Effect.Effect<{ url: string }, PullRequestActionRefusedError>;
  }
>()('@porcelain/reviews/CommentOnGitHubPullRequestService') {
  static readonly layer = Layer.effect(
    CommentOnGitHubPullRequestService,
    Effect.gen(function* () {
      const actions = yield* GitHubPullRequestActions;
      return {
        execute: Effect.fn('CommentOnGitHubPullRequestService.execute')(
          function* ({ target, body }) {
            if (target.kind === 'unavailable')
              return yield* new PullRequestActionRefusedError({
                reason: target.reason,
              });
            return yield* actions.comment({
              ...target.repository,
              account: target.account,
              number: target.number,
              body,
            });
          },
        ),
      };
    }),
  );
}
