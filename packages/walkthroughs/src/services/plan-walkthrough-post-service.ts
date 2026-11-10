import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import type { PostPlan, PostSelection } from '../models/conversation.ts';
import { WalkthroughMessageNotFoundError } from '../errors/walkthrough-message-not-found-error.ts';
import { planPost } from '../rules/conversations.ts';
export class PlanWalkthroughPostService extends Context.Service<
  PlanWalkthroughPostService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
      selection: PostSelection;
    }) => Effect.Effect<
      PostPlan,
      WalkthroughMessageNotFoundError | WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/PlanWalkthroughPostService') {
  static readonly layer = Layer.effect(
    PlanWalkthroughPostService,
    Effect.gen(function* () {
      const current = yield* ReadWalkthroughTargetService;
      return {
        execute: Effect.fn('PlanWalkthroughPostService.execute')(
          function* (input) {
            const { target, readyRuns, messages } =
              yield* current.execute(input);
            const { selection } = input;
            if (
              selection.kind === 'message' &&
              !messages.some((message) => message.id === selection.messageId)
            )
              return yield* new WalkthroughMessageNotFoundError();
            return planPost({ selection, target, readyRuns, messages });
          },
        ),
      };
    }),
  );
}
