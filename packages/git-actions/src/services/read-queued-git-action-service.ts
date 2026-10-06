import { Context, Effect, Layer } from 'effect';
import { type BeginGitActionInput } from '../models/begin-git-action.ts';
import { type ReadQueuedGitActionResult } from '../models/read-queued-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';

export class ReadQueuedGitActionService extends Context.Service<
  ReadQueuedGitActionService,
  {
    readonly execute: (
      input: BeginGitActionInput,
    ) => Effect.Effect<ReadQueuedGitActionResult>;
  }
>()('@porcelain/git-actions/ReadQueuedGitActionService') {
  static readonly layer = Layer.effect(
    ReadQueuedGitActionService,
    Effect.gen(function* () {
      const receipts = yield* GitActionReceiptStore;
      return {
        execute: Effect.fn('ReadQueuedGitActionService.execute')(function* (
          input: BeginGitActionInput,
        ): Effect.fn.Return<ReadQueuedGitActionResult> {
          const receipt = yield* receipts.read(input);
          if (
            !receipt ||
            receipt.requestId !== input.requestId ||
            receipt.acceptedAt !== input.acceptedAt
          )
            return { kind: 'unavailable' };
          return {
            kind: 'ready',
            receipt: {
              requestId: receipt.requestId,
              acceptedAt: receipt.acceptedAt,
              projectId: receipt.projectId,
              worktreeId: receipt.worktreeId,
              intent: receipt.intent,
              state: receipt.state,
            },
          };
        }),
      };
    }),
  );
}
