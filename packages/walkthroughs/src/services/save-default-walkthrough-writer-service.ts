import { WalkthroughModelReader } from '../ports/walkthrough-model-reader.ts';
import { UnsupportedWalkthroughEffortError } from '../errors/unsupported-walkthrough-effort-error.ts';
import { unsupportedWalkthroughEffort } from '../rules/walkthrough-writer.ts';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughWriterChoice } from '../models/walkthrough.ts';
export class SaveDefaultWalkthroughWriterService extends Context.Service<
  SaveDefaultWalkthroughWriterService,
  {
    readonly execute: (
      writer: WalkthroughWriterChoice,
    ) => Effect.Effect<
      WalkthroughWriterChoice,
      UnsupportedWalkthroughEffortError
    >;
  }
>()('@porcelain/walkthroughs/SaveDefaultWalkthroughWriterService') {
  static readonly layer = Layer.effect(
    SaveDefaultWalkthroughWriterService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const models = yield* WalkthroughModelReader;
      return {
        execute: Effect.fn('SaveDefaultWalkthroughWriterService.execute')(
          function* (writer: WalkthroughWriterChoice) {
            const unsupported = unsupportedWalkthroughEffort(
              writer,
              yield* models.read(),
            );
            if (unsupported)
              return yield* new UnsupportedWalkthroughEffortError(unsupported);
            yield* store.saveDefaultWriter(writer);
            return writer;
          },
        ),
      };
    }),
  );
}
