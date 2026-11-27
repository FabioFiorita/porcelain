import { walkthroughWriterAvailability } from '../rules/walkthrough-writer.ts';
import { Context, Effect, Layer } from 'effect';
import { ResolveWalkthroughWriterService } from './resolve-walkthrough-writer-service.ts';
import { WalkthroughModelReader } from '../ports/walkthrough-model-reader.ts';
import {
  type WalkthroughModel,
  type WalkthroughWriterChoice,
} from '../models/walkthrough.ts';
export class ReadWalkthroughWriterSettingsService extends Context.Service<
  ReadWalkthroughWriterSettingsService,
  {
    readonly execute: (input: {
      projectId: string | undefined;
      refresh: boolean;
    }) => Effect.Effect<{
      writer: WalkthroughWriterChoice;
      models: readonly WalkthroughModel[];
      availability: ReturnType<typeof walkthroughWriterAvailability>['kind'];
    }>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughWriterSettingsService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughWriterSettingsService,
    Effect.gen(function* () {
      const resolve = yield* ResolveWalkthroughWriterService;
      const reader = yield* WalkthroughModelReader;
      const [readCatalog, invalidateCatalog] =
        yield* Effect.cachedInvalidateWithTTL(reader.read(), '15 seconds');
      return {
        execute: Effect.fn('ReadWalkthroughWriterSettingsService.execute')(
          function* ({ projectId, refresh }) {
            if (refresh) yield* invalidateCatalog;
            const models = yield* readCatalog;
            const writer = yield* resolve.execute({
              projectId,
              writer: undefined,
              models,
            });
            return {
              writer,
              models,
              availability: walkthroughWriterAvailability(writer, models).kind,
            };
          },
        ),
      };
    }),
  );
}
