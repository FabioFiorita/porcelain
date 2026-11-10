import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughSettings } from '../models/walkthrough.ts';
export class SaveWalkthroughSettingsService extends Context.Service<
  SaveWalkthroughSettingsService,
  {
    readonly execute: (input: {
      projectId: string;
      settings: WalkthroughSettings;
    }) => Effect.Effect<WalkthroughSettings>;
  }
>()('@porcelain/walkthroughs/SaveWalkthroughSettingsService') {
  static readonly layer = Layer.effect(
    SaveWalkthroughSettingsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('SaveWalkthroughSettingsService.execute')(
          function* (input: {
            projectId: string;
            settings: WalkthroughSettings;
          }) {
            yield* store.saveSettings(input.projectId, input.settings);
            return input.settings;
          },
        ),
      };
    }),
  );
}
