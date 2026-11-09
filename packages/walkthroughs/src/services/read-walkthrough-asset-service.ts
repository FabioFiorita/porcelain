import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { EvidenceAsset } from '../models/walkthrough.ts';
export class ReadWalkthroughAssetService extends Context.Service<
  ReadWalkthroughAssetService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      assetId: string;
    }) => Effect.Effect<EvidenceAsset | undefined>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughAssetService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughAssetService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadWalkthroughAssetService.execute')(
          function* (input) {
            return yield* store.readAsset(
              input.runId,
              input.assetId,
              input.worktreeId,
            );
          },
        ),
      };
    }),
  );
}
