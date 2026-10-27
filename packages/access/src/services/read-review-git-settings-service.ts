import { Effect, Context, Layer } from 'effect';
import type { ReviewGitSettingsSnapshot } from '../models/review-git-settings.ts';
import { ReviewGitSettingsStore } from '../ports/review-git-settings-store.ts';

export class ReadReviewGitSettingsService extends Context.Service<
  ReadReviewGitSettingsService,
  {
    readonly execute: () => Effect.Effect<ReviewGitSettingsSnapshot, never>;
  }
>()('@porcelain/access/ReadReviewGitSettingsService') {
  static readonly layer = Layer.effect(
    ReadReviewGitSettingsService,
    Effect.gen(function* () {
      const settings = yield* ReviewGitSettingsStore;

      return {
        execute: Effect.fn('ReadReviewGitSettingsService.execute')(
          function* (): Effect.fn.Return<ReviewGitSettingsSnapshot, never> {
            return yield* settings.read();
          },
        ),
      };
    }),
  );
}
