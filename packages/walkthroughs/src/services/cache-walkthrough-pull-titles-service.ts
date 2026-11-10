import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
export class CacheWalkthroughPullTitlesService extends Context.Service<
  CacheWalkthroughPullTitlesService,
  {
    readonly execute: (input: {
      projectId: string;
      pulls: readonly { branch: string; title: string }[];
    }) => Effect.Effect<boolean>;
  }
>()('@porcelain/walkthroughs/CacheWalkthroughPullTitlesService') {
  static readonly layer = Layer.effect(
    CacheWalkthroughPullTitlesService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('CacheWalkthroughPullTitlesService.execute')(
          function* (input: {
            projectId: string;
            pulls: readonly { branch: string; title: string }[];
          }) {
            return yield* store.cachePullRequests(input.projectId, input.pulls);
          },
        ),
      };
    }),
  );
}
