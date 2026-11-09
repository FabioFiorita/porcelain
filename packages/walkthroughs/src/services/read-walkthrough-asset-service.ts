import { Context, Effect, Layer } from 'effect';
import { WalkthroughAssetNotFoundError } from '../errors/walkthrough-asset-not-found-error.ts';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { EvidenceAsset } from '../models/walkthrough.ts';
export class ReadWalkthroughAssetService extends Context.Service<
  ReadWalkthroughAssetService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      assetId: string;
    }) => Effect.Effect<EvidenceAsset, WalkthroughAssetNotFoundError>;
  }
>()('@porcelain/walkthroughs/ReadWalkthroughAssetService') {
  static readonly layer = Layer.effect(
    ReadWalkthroughAssetService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ReadWalkthroughAssetService.execute')(
          function* (input) {
            const asset = yield* store.readAsset(
              input.runId,
              input.assetId,
              input.worktreeId,
            );
            if (asset === undefined)
              return yield* new WalkthroughAssetNotFoundError();
            return asset;
          },
        ),
      };
    }),
  );
}
