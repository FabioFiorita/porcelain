import { Context, Effect, Layer } from 'effect';
import type { WalkthroughWriterSettings } from '@porcelain/contracts/walkthroughs';
import { ReadWalkthroughWriterSettingsService } from '@porcelain/walkthroughs/services';
export class ReadWalkthroughWriterSettingsUseCase extends Context.Service<
  ReadWalkthroughWriterSettingsUseCase,
  { readonly execute: () => Effect.Effect<WalkthroughWriterSettings> }
>()('@porcelain/server/ReadWalkthroughWriterSettingsUseCase') {
  static readonly layer = Layer.effect(
    ReadWalkthroughWriterSettingsUseCase,
    Effect.gen(function* () {
      const service = yield* ReadWalkthroughWriterSettingsService;
      return {
        execute: Effect.fn('ReadWalkthroughWriterSettingsUseCase.execute')(
          function* () {
            const result = yield* service.execute();
            return result;
          },
        ),
      };
    }),
  );
}
