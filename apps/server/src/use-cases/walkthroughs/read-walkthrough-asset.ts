import { Context, Effect, Layer } from 'effect';
import { ReadWalkthroughAssetService } from '@porcelain/walkthroughs/services';
import type { WalkthroughAssetParams } from '@porcelain/contracts/walkthroughs';
import type { WalkthroughAssetNotFoundError } from '@porcelain/walkthroughs/errors';
import type { EvidenceAsset } from '@porcelain/walkthroughs/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
export class ReadWalkthroughAssetUseCase extends Context.Service<
  ReadWalkthroughAssetUseCase,
  {
    readonly execute: (
      input: WalkthroughAssetParams,
    ) => Effect.Effect<
      EvidenceAsset,
      WorktreeAccessFailure | WalkthroughAssetNotFoundError
    >;
  }
>()('@porcelain/server/ReadWalkthroughAssetUseCase') {
  static readonly layer = Layer.effect(
    ReadWalkthroughAssetUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const service = yield* ReadWalkthroughAssetService;
      return {
        execute: Effect.fn('ReadWalkthroughAssetUseCase.execute')((input) =>
          access.read(input.worktreeId, () => service.execute(input)),
        ),
      };
    }),
  );
}
