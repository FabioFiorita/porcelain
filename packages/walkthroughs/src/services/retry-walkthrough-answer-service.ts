import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
export class RetryWalkthroughAnswerService extends Context.Service<
  RetryWalkthroughAnswerService,
  {
    readonly execute: (input: {
      worktreeId: string;
      messageId: string;
    }) => Effect.Effect<boolean, WalkthroughMessageNotFoundError>;
  }
>()('@porcelain/walkthroughs/RetryWalkthroughAnswerService') {
  static readonly layer = Layer.effect(
    RetryWalkthroughAnswerService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('RetryWalkthroughAnswerService.execute')(
          function* (input) {
            if (
              (yield* store.readMessage(input.worktreeId, input.messageId)) ===
              undefined
            )
              return yield* new WalkthroughMessageNotFoundError();
            return yield* store.requeueAnswer(
              input.worktreeId,
              input.messageId,
            );
          },
        ),
      };
    }),
  );
}
