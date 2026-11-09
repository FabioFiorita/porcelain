import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
export class BeginWalkthroughService extends Context.Service<
  BeginWalkthroughService,
  { readonly execute: (id: string) => Effect.Effect<boolean> }
>()('@porcelain/walkthroughs/BeginWalkthroughService') {
  static readonly layer = Layer.effect(
    BeginWalkthroughService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('BeginWalkthroughService.execute')((id) =>
          store.claim(id),
        ),
      };
    }),
  );
}
