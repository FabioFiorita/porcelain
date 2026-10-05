import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import {
  type FinishGitActionInput,
  type FinishGitActionResult,
} from '../models/finish-git-action.ts';
import { type GitActionReceipt } from '../models/git-action-receipt.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class FinishGitActionService extends Context.Service<
  FinishGitActionService,
  {
    readonly execute: (
      input: FinishGitActionInput,
    ) => Effect.Effect<FinishGitActionResult, GitActionNotFoundError, never>;
  }
>()('@porcelain/git-actions/FinishGitActionService') {
  static readonly layer = Layer.effect(
    FinishGitActionService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('FinishGitActionService.execute')(function* (
          input: FinishGitActionInput,
        ): Effect.fn.Return<
          FinishGitActionResult,
          GitActionNotFoundError,
          never
        > {
          const current = yield* gitActionReceiptsCapability.read({
            requestId: input.requestId,
          });
          if (!current) return yield* Effect.fail(new GitActionNotFoundError());
          const { outcome } = input;
          const finished: GitActionReceipt = {
            ...current,
            state:
              outcome.state === 'indeterminate' ? 'interrupted' : outcome.state,
            reason: outcome.reason,
            message: outcome.message,
            result: outcome.result,
            refreshRequired: outcome.refreshRequired,
            finishedAt: clockCapability.now(),
          };
          yield* gitActionReceiptsCapability.save(finished);
          return gitActionReceiptView(finished);
        }),
      };
    }),
  );
}
