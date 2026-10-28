import { Context, Effect, Layer } from 'effect';
import type { GitHubAccountPreference } from '../models/pull-request.ts';
import { GitHubAccountStore } from '../ports/github-account-store.ts';
export class GitHubAccountPreferenceService extends Context.Service<
  GitHubAccountPreferenceService,
  {
    readonly execute: (input: {
      projectId: string;
      repository: string;
      override?: { account: string | undefined };
      detected?: string;
    }) => Effect.Effect<GitHubAccountPreference | undefined>;
  }
>()('@porcelain/reviews/GitHubAccountPreferenceService') {
  static readonly layer = Layer.effect(
    GitHubAccountPreferenceService,
    Effect.gen(function* () {
      const store = yield* GitHubAccountStore;
      return {
        execute: Effect.fn('GitHubAccountPreferenceService.execute')(
          function* (input) {
            if (input.override !== undefined)
              yield* store.override({
                projectId: input.projectId,
                repository: input.repository,
                account: input.override.account,
              });
            if (input.detected !== undefined)
              yield* store.detect({
                projectId: input.projectId,
                repository: input.repository,
                account: input.detected,
              });
            return yield* store.read(input);
          },
        ),
      };
    }),
  );
}
