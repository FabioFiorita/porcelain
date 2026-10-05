import { Effect, Context, Layer } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
import { Clock } from '@porcelain/kernel/ports';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { interruptedReceipt } from '../rules/interrupted-receipt.ts';

export class RecoverInterruptedGitActionsService extends Context.Service<
  RecoverInterruptedGitActionsService,
  {
    readonly execute: (input: WorktreeKey) => Effect.Effect<void, never, never>;
  }
>()('@porcelain/git-actions/RecoverInterruptedGitActionsService') {
  static readonly layer = Layer.effect(
    RecoverInterruptedGitActionsService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('RecoverInterruptedGitActionsService.execute')(
          function* (input: WorktreeKey): Effect.fn.Return<void, never, never> {
            return yield* Effect.sync<void>(() => {
              const finishedAt = clockCapability.now();
              for (const receipt of gitActionReceiptsCapability.running())
                if (receipt.worktreeId === input.worktreeId)
                  gitActionReceiptsCapability.save(
                    interruptedReceipt(receipt, finishedAt),
                  );
            });
          },
        ),
      };
    }),
  );
}
