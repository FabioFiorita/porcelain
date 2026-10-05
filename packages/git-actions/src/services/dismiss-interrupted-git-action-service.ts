import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import {
  type DismissInterruptedGitActionInput,
  type DismissInterruptedGitActionResult,
} from '../models/dismiss-interrupted-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class DismissInterruptedGitActionService extends Context.Service<
  DismissInterruptedGitActionService,
  {
    readonly execute: (
      input: DismissInterruptedGitActionInput,
    ) => Effect.Effect<
      DismissInterruptedGitActionResult,
      GitActionNotFoundError | GitActionReceiptMismatchError,
      never
    >;
  }
>()('@porcelain/git-actions/DismissInterruptedGitActionService') {
  static readonly layer = Layer.effect(
    DismissInterruptedGitActionService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;
      const clockCapability = yield* Clock;

      return {
        execute: Effect.fn('DismissInterruptedGitActionService.execute')(
          function* (
            input: DismissInterruptedGitActionInput,
          ): Effect.fn.Return<
            DismissInterruptedGitActionResult,
            GitActionNotFoundError | GitActionReceiptMismatchError,
            never
          > {
            const receipt = gitActionReceiptsCapability.read({
              requestId: input.requestId,
            });
            if (!receipt)
              return yield* Effect.fail(new GitActionNotFoundError());
            if (
              receipt.projectId !== input.projectId ||
              receipt.worktreeId !== input.worktreeId ||
              receipt.state !== 'interrupted'
            )
              return yield* Effect.fail(new GitActionReceiptMismatchError());
            if (receipt.dismissedAt !== undefined)
              return {
                kind: 'already-dismissed',
                receipt: gitActionReceiptView(receipt),
              };
            const dismissed = {
              ...receipt,
              dismissedAt: clockCapability.now(),
            };
            gitActionReceiptsCapability.save(dismissed);
            return {
              kind: 'dismissed',
              receipt: gitActionReceiptView(dismissed),
            };
          },
        ),
      };
    }),
  );
}
