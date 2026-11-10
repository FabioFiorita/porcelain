import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughWriterChoice } from '../models/walkthrough.ts';
export class SaveDefaultWalkthroughWriterService extends Context.Service<
  SaveDefaultWalkthroughWriterService,
  {
    readonly execute: (
      writer: WalkthroughWriterChoice,
    ) => Effect.Effect<WalkthroughWriterChoice>;
  }
>()('@porcelain/walkthroughs/SaveDefaultWalkthroughWriterService') {
  static readonly layer = Layer.effect(
    SaveDefaultWalkthroughWriterService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('SaveDefaultWalkthroughWriterService.execute')(
          function* (writer: WalkthroughWriterChoice) {
            yield* store.saveDefaultWriter(writer);
            return writer;
          },
        ),
      };
    }),
  );
}
