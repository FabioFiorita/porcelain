import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
export class SaveWalkthroughMessageService extends Context.Service<
  SaveWalkthroughMessageService,
  {
    readonly execute: (input: {
      worktreeId: string;
      messageId: string;
      saved: boolean;
    }) => Effect.Effect<void, WalkthroughMessageNotFoundError>;
  }
>()('@porcelain/walkthroughs/SaveWalkthroughMessageService') {
  static readonly layer = Layer.effect(
    SaveWalkthroughMessageService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('SaveWalkthroughMessageService.execute')(
          function* (input) {
            if (
              (yield* store.readMessage(input.worktreeId, input.messageId)) ===
              undefined
            )
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
