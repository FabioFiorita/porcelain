import { Context, Effect, Layer } from 'effect';
import {
  type BeginGitActionInput,
  type BeginGitActionResult,
} from '../models/begin-git-action.ts';
import { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionTarget } from '../rules/git-action-target.ts';
import { InterruptGitActionService } from './interrupt-git-action-service.ts';

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
      const interrupt = yield* InterruptGitActionService;
      return {
        execute: Effect.fn('BeginGitActionService.execute')(function* (
          input: BeginGitActionInput,
        ): Effect.fn.Return<BeginGitActionResult> {
          const receipt = yield* receipts.read(input);
          if (
            !receipt ||
            receipt.state !== 'running' ||
            receipt.acceptedAt !== input.acceptedAt
          )
            return { kind: 'unavailable' };
          // This durable claim precedes foreign IO; missing legacy claims and
          // previously started writes have an unknown outcome and never replay.
          if (!(yield* receipts.claimExecution(input))) {
            yield* interrupt.execute(input).pipe(Effect.orDie);
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
