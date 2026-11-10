import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
export class SaveWalkthroughMessageService extends Context.Service<
  SaveWalkthroughMessageService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      messageId: string;
      saved: boolean;
    }) => Effect.Effect<
      void,
      WalkthroughMessageNotFoundError | WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/SaveWalkthroughMessageService') {
  static readonly layer = Layer.effect(
    SaveWalkthroughMessageService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const target = yield* ReadWalkthroughTargetService;
      return {
        execute: Effect.fn('SaveWalkthroughMessageService.execute')(
          function* (input) {
            const { messages } = yield* target.execute(input);
            if (!messages.some((message) => message.id === input.messageId))
              return yield* new WalkthroughMessageNotFoundError();
            yield* store.saveForLater(
              input.worktreeId,
              input.messageId,
              input.saved,
            );
          },
        ),
      };
    }),
  );
}
