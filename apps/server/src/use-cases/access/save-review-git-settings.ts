import { Context, Effect, Layer } from 'effect';
import {
  type ReviewGitSettingsNotConfiguredError,
  type ReviewGitSettingsTrustRequiredError,
} from '@porcelain/access/errors';
import { SaveReviewGitSettingsService } from '@porcelain/access/services';
import {
  type SaveReviewGitSettingsInput,
  type SaveReviewGitSettingsResponse,
} from '@porcelain/contracts/access';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SaveReviewGitSettingsUseCase extends Context.Service<
  SaveReviewGitSettingsUseCase,
  {
    readonly execute: (
      input: SaveReviewGitSettingsInput,
    ) => Effect.Effect<
      SaveReviewGitSettingsResponse,
      ReviewGitSettingsTrustRequiredError | ReviewGitSettingsNotConfiguredError
    >;
  }
>()('@porcelain/server/SaveReviewGitSettingsUseCase') {
  static readonly layer = Layer.effect(
    SaveReviewGitSettingsUseCase,
    Effect.gen(function* () {
      const saveSettingsCapability = yield* SaveReviewGitSettingsService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('SaveReviewGitSettingsUseCase.execute')(function* (
          input: SaveReviewGitSettingsInput,
        ): Effect.fn.Return<
          SaveReviewGitSettingsResponse,
          | ReviewGitSettingsTrustRequiredError
          | ReviewGitSettingsNotConfiguredError
        > {
          return yield* lanesCapability.commit(
            laneKeysCapability.access(),
            () => Effect.uninterruptible(saveSettingsCapability.execute(input)),
            () => eventsCapability.inventoryChanged(),
          );
        }),
      };
    }),
  );
}
