import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import {
  type BeginGitActionInput,
  type BeginGitActionResult,
} from '../models/begin-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionTarget } from '../rules/git-action-target.ts';
import { interruptedReceipt } from '../rules/interrupted-receipt.ts';

export class BeginGitActionService extends Context.Service<
  BeginGitActionService,
  {
    readonly execute: (
      input: BeginGitActionInput,
    ) => Effect.Effect<BeginGitActionResult>;
  }
>()('@porcelain/git-actions/BeginGitActionService') {
  static readonly layer = Layer.effect(
    BeginGitActionService,
    Effect.gen(function* () {
      const receipts = yield* GitActionReceiptStore;
      const clock = yield* Clock.Clock;
      return {
        execute: Effect.fn('BeginGitActionService.execute')(function* (
          input: BeginGitActionInput,
        ): Effect.fn.Return<BeginGitActionResult> {
          const receipt = yield* receipts.read(input);
          if (
            !receipt ||
            receipt.requestId !== input.requestId ||
            receipt.state !== 'running' ||
            receipt.acceptedAt !== input.acceptedAt
          )
            return { kind: 'unavailable' };
          if (!(yield* receipts.claimExecution(input))) {
            const finishedAt = DateTime.formatIso(
              DateTime.makeUnsafe(yield* clock.currentTimeMillis),
            );
            yield* receipts.save(interruptedReceipt(receipt, finishedAt));
            return { kind: 'unavailable' };
          }
          return {
            kind: 'ready',
            run: {
              requestId: receipt.requestId,
              projectId: receipt.projectId,
              worktreeId: receipt.worktreeId,
              intent: receipt.intent,
              expected: receipt.expected,
              target: gitActionTarget(receipt.intent, receipt.expected),
            },
          };
        }),
      };
    }),
  );
}
