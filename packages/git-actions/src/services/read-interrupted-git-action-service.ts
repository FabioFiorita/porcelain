import { Effect, Context, Layer } from 'effect';
import {
  type ReadInterruptedGitActionInput,
  type ReadInterruptedGitActionResult,
} from '../models/read-interrupted-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadInterruptedGitActionService extends Context.Service<
  ReadInterruptedGitActionService,
  {
    readonly execute: (
      input: ReadInterruptedGitActionInput,
    ) => Effect.Effect<ReadInterruptedGitActionResult, never, never>;
  }
>()('@porcelain/git-actions/ReadInterruptedGitActionService') {
  static readonly layer = Layer.effect(
    ReadInterruptedGitActionService,
    Effect.gen(function* () {
      const gitActionReceiptsCapability = yield* GitActionReceiptStore;

      return {
        execute: Effect.fn('ReadInterruptedGitActionService.execute')(
          function* (
            input: ReadInterruptedGitActionInput,
          ): Effect.fn.Return<ReadInterruptedGitActionResult, never, never> {
            const receipt =
              yield* gitActionReceiptsCapability.latestInterrupted({
                worktreeId: input.worktreeId,
              });
            return receipt
              ? {
                  kind: 'interrupted',
                  receipt: gitActionReceiptView(receipt),
                }
              : { kind: 'none' };
          },
        ),
      };
    }),
  );
}
