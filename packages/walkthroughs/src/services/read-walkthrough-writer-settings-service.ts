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
    readonly execute: (projectId: string | undefined) => Effect.Effect<{
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
      return {
        execute: Effect.fn('ReadWalkthroughWriterSettingsService.execute')(
          function* (projectId) {
            const writer = yield* resolve.execute({
              projectId,
              writer: undefined,
            });
            const models = yield* reader.read();
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
