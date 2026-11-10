import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
export class RetryWalkthroughAnswerService extends Context.Service<
  RetryWalkthroughAnswerService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      messageId: string;
    }) => Effect.Effect<
      boolean,
      WalkthroughMessageNotFoundError | WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/RetryWalkthroughAnswerService') {
  static readonly layer = Layer.effect(
    RetryWalkthroughAnswerService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const target = yield* ReadWalkthroughTargetService;
      return {
        execute: Effect.fn('RetryWalkthroughAnswerService.execute')(
          function* (input) {
            const { messages } = yield* target.execute(input);
            if (!messages.some((message) => message.id === input.messageId))
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
