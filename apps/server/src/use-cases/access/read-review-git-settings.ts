import { Context, Effect, Layer } from 'effect';
import { ReadReviewGitSettingsService } from '@porcelain/access/services';
import { type ReadReviewGitSettingsResponse } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadReviewGitSettingsUseCase extends Context.Service<
  ReadReviewGitSettingsUseCase,
  {
    readonly execute: () => Effect.Effect<ReadReviewGitSettingsResponse>;
  }
>()('@porcelain/server/ReadReviewGitSettingsUseCase') {
  static readonly layer = Layer.effect(
    ReadReviewGitSettingsUseCase,
    Effect.gen(function* () {
      const readSettingsCapability = yield* ReadReviewGitSettingsService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadReviewGitSettingsUseCase.execute')(
          function* (): Effect.fn.Return<ReadReviewGitSettingsResponse> {
            return yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () => readSettingsCapability.execute(),
            );
          },
        ),
      };
    }),
  );
}
