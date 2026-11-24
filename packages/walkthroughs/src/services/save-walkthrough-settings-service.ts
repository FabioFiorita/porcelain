import { WalkthroughModelReader } from '../ports/walkthrough-model-reader.ts';
import { UnsupportedWalkthroughEffortError } from '../errors/unsupported-walkthrough-effort-error.ts';
import { unsupportedWalkthroughEffort } from '../rules/walkthrough-writer.ts';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughSettings } from '../models/walkthrough.ts';
export class SaveWalkthroughSettingsService extends Context.Service<
  SaveWalkthroughSettingsService,
  {
    readonly execute: (input: {
      projectId: string;
      settings: WalkthroughSettings;
    }) => Effect.Effect<WalkthroughSettings, UnsupportedWalkthroughEffortError>;
  }
>()('@porcelain/walkthroughs/SaveWalkthroughSettingsService') {
  static readonly layer = Layer.effect(
    SaveWalkthroughSettingsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const models = yield* WalkthroughModelReader;
      return {
        execute: Effect.fn('SaveWalkthroughSettingsService.execute')(
          function* (input: {
            projectId: string;
            settings: WalkthroughSettings;
          }) {
            if (input.settings.writer) {
              const unsupported = unsupportedWalkthroughEffort(
                input.settings.writer,
                yield* models.read(),
              );
              if (unsupported)
                return yield* new UnsupportedWalkthroughEffortError(
                  unsupported,
                );
            }
            yield* store.saveSettings(input.projectId, input.settings);
            return input.settings;
          },
        ),
      };
    }),
  );
}
