import { Context, Effect, Layer } from 'effect';
import type {
  WalkthroughWriterSettings,
  WalkthroughWriterSettingsQuery,
} from '@porcelain/contracts/walkthroughs';
import { ReadWalkthroughWriterSettingsService } from '@porcelain/walkthroughs/services';
export class ReadWalkthroughWriterSettingsUseCase extends Context.Service<
  ReadWalkthroughWriterSettingsUseCase,
  {
    readonly execute: (
      input: WalkthroughWriterSettingsQuery,
    ) => Effect.Effect<WalkthroughWriterSettings>;
  }
>()('@porcelain/server/ReadWalkthroughWriterSettingsUseCase') {
  static readonly layer = Layer.effect(
    ReadWalkthroughWriterSettingsUseCase,
    Effect.gen(function* () {
      const service = yield* ReadWalkthroughWriterSettingsService;
      return {
        execute: Effect.fn('ReadWalkthroughWriterSettingsUseCase.execute')(
          function* ({ projectId, refresh }) {
            const result = yield* service.execute({
              projectId,
              refresh: refresh === 'true',
            });
            return result;
          },
        ),
      };
    }),
  );
}
