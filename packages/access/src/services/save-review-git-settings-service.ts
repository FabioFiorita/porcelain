import { Effect, Context, Layer } from 'effect';
import { ReviewGitSettingsNotConfiguredError } from '../errors/review-git-settings-not-configured-error.ts';
import { ReviewGitSettingsTrustRequiredError } from '../errors/review-git-settings-trust-required-error.ts';
import type {
  ConfiguredReviewGitSettings,
  SaveReviewGitSettingsInput,
} from '../models/review-git-settings.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { ReviewGitSettingsStore } from '../ports/review-git-settings-store.ts';
import { deviceTrusted } from '../rules/device-activity.ts';
import { savedReviewGitSettings } from '../rules/review-git-settings.ts';

export class SaveReviewGitSettingsService extends Context.Service<
  SaveReviewGitSettingsService,
  {
    readonly execute: (
      input: SaveReviewGitSettingsInput,
    ) => Effect.Effect<
      ConfiguredReviewGitSettings,
      ReviewGitSettingsTrustRequiredError | ReviewGitSettingsNotConfiguredError
    >;
  }
>()('@porcelain/access/SaveReviewGitSettingsService') {
  static readonly layer = Layer.effect(
    SaveReviewGitSettingsService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;
      const settings = yield* ReviewGitSettingsStore;

      return {
        execute: Effect.fn('SaveReviewGitSettingsService.execute')(function* (
          input: SaveReviewGitSettingsInput,
        ): Effect.fn.Return<
          ConfiguredReviewGitSettings,
          | ReviewGitSettingsTrustRequiredError
          | ReviewGitSettingsNotConfiguredError
        > {
          const { viewer } = input;
          if (
            viewer.kind === 'device' &&
            !input.local &&
            !deviceTrusted(yield* devices.find({ deviceId: viewer.deviceId }))
          )
            return yield* Effect.fail(
              new ReviewGitSettingsTrustRequiredError(),
            );
          const outcome = savedReviewGitSettings(
            yield* settings.read(),
            input.save,
          );
          if (outcome.kind === 'not-configured')
            return yield* Effect.fail(
              new ReviewGitSettingsNotConfiguredError(),
            );
          if (outcome.kind === 'saved') yield* settings.write(outcome.settings);
          return outcome.settings;
        }),
      };
    }),
  );
}
