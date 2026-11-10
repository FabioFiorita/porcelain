import { builtInWalkthroughWriter } from '../rules/walkthrough-writer.ts';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughInventoryReader } from '../ports/walkthrough-inventory-reader.ts';
import { WalkthroughModelReader } from '../ports/walkthrough-model-reader.ts';
import {
  type WalkthroughModel,
  type WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
export class ReadWalkthroughWriterSettingsService extends Context.Service<
  ReadWalkthroughWriterSettingsService,
  {
    readonly execute: () => Effect.Effect<{
      writer: WalkthroughWriterChoice;
      models: readonly WalkthroughModel[];
    }>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughWriterSettingsService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughWriterSettingsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughInventoryReader;
      const models = yield* WalkthroughModelReader;
      return {
        execute: Effect.fn('ReadWalkthroughWriterSettingsService.execute')(
          function* () {
            return {
              writer:
                (yield* store.readDefaultWriter()) ?? builtInWalkthroughWriter,
              models: yield* models.read(),
            };
          },
        ),
      };
    }),
  );
}
