import { Context, Effect, Layer } from 'effect';
import { WalkthroughInventoryReader } from '../ports/walkthrough-inventory-reader.ts';
export class ReadProjectWalkthroughsService extends Context.Service<
  ReadProjectWalkthroughsService,
  {
    readonly execute: (
      input: Parameters<WalkthroughInventoryReader['readProject']>[0],
    ) => ReturnType<WalkthroughInventoryReader['readProject']>;
  }
>()('@porcelain/walkthroughs/ReadProjectWalkthroughsService') {
  static readonly layer = Layer.effect(
    ReadProjectWalkthroughsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughInventoryReader;
      return {
        execute: Effect.fn('ReadProjectWalkthroughsService.execute')(function* (
          input: Parameters<WalkthroughInventoryReader['readProject']>[0],
        ) {
          return yield* store.readProject(input);
        }),
      };
    }),
  );
}
