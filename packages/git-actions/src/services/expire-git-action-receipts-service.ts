import { ExpireGitActionReceiptsOptions } from '../ports/expire-git-action-receipts-options.ts';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
import { Clock } from '@porcelain/kernel/ports';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { expiredReceipts } from '../rules/expired-receipts.ts';

export class ExpireGitActionReceiptsService extends Context.Service<
  ExpireGitActionReceiptsService,
  {
    readonly execute: (input: WorktreeKey) => Effect.Effect<void, never, never>;
  }
>()('@porcelain/git-actions/ExpireGitActionReceiptsService') {
  static readonly layer = Layer.effect(
    ExpireGitActionReceiptsService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;
      const optionsCapability = yield* ExpireGitActionReceiptsOptions;

      return {
        execute: Effect.fn('ExpireGitActionReceiptsService.execute')(function* (
          input: WorktreeKey,
        ): Effect.fn.Return<void, never, never> {
          return yield* Effect.sync<void>(() => {
            gitActionReceiptsCapability.remove({
              requestIds: expiredReceipts(
                gitActionReceiptsCapability.finished(),
                clockCapability.now(),
                optionsCapability.retentionMs,
              ).filter(
                (requestId) =>
                  gitActionReceiptsCapability.read({ requestId })
                    ?.worktreeId === input.worktreeId,
              ),
            });
          });
        }),
      };
    }),
  );
}
