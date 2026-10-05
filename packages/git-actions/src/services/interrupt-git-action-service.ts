import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import {
  type InterruptGitActionInput,
  type InterruptGitActionResult,
} from '../models/interrupt-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { interruptedReceipt } from '../rules/interrupted-receipt.ts';

export class InterruptGitActionService extends Context.Service<
  InterruptGitActionService,
  {
    readonly execute: (
      input: InterruptGitActionInput,
    ) => Effect.Effect<InterruptGitActionResult, GitActionNotFoundError, never>;
  }
>()('@porcelain/git-actions/InterruptGitActionService') {
  static readonly layer = Layer.effect(
    InterruptGitActionService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('InterruptGitActionService.execute')(function* (
          input: InterruptGitActionInput,
        ): Effect.fn.Return<
          InterruptGitActionResult,
          GitActionNotFoundError,
          never
        > {
          const current = yield* gitActionReceiptsCapability.read({
            requestId: input.requestId,
          });
          if (!current) return yield* Effect.fail(new GitActionNotFoundError());
          if (current.state !== 'running') return gitActionReceiptView(current);
          const interrupted = interruptedReceipt(
            current,
            clockCapability.now(),
          );
          yield* gitActionReceiptsCapability.save(interrupted);
          return gitActionReceiptView(interrupted);
        }),
      };
    }),
  );
}
