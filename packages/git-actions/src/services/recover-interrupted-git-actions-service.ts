import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { type WorktreeKey } from '@porcelain/kernel/models';
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
      const clockCapability = yield* Clock.Clock;

      return {
        execute: Effect.fn('RecoverInterruptedGitActionsService.execute')(
          function* (input: WorktreeKey): Effect.fn.Return<void, never, never> {
            const finishedAt = DateTime.formatIso(
              DateTime.makeUnsafe(yield* clockCapability.currentTimeMillis),
            );
            for (const receipt of yield* gitActionReceiptsCapability.running())
              if (receipt.worktreeId === input.worktreeId)
                yield* gitActionReceiptsCapability.save(
                  interruptedReceipt(receipt, finishedAt),
                );
          },
        ),
      };
    }),
  );
}
