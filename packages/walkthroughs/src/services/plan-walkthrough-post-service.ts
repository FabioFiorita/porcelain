import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { PostPlan, PostSelection } from '../models/conversation.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
import { planPost } from '../rules/conversations.ts';
export class PlanWalkthroughPostService extends Context.Service<
  PlanWalkthroughPostService,
  {
    readonly execute: (input: {
      worktreeId: string;
      selection: PostSelection;
    }) => Effect.Effect<PostPlan, WalkthroughMessageNotFoundError>;
  }
>()('@porcelain/walkthroughs/PlanWalkthroughPostService') {
  static readonly layer = Layer.effect(
    PlanWalkthroughPostService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('PlanWalkthroughPostService.execute')(
          function* (input) {
            const [readyRuns, messages] = yield* Effect.all([
              store.listReadyRuns(input.worktreeId),
              store.listMessages(input.worktreeId),
            ]);
            const { selection } = input;
            if (
              selection.kind === 'message' &&
              !messages.some((message) => message.id === selection.messageId)
            )
              return yield* new WalkthroughMessageNotFoundError();
            return planPost({ selection, readyRuns, messages });
          },
        ),
      };
    }),
  );
}
