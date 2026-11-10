import { ReadWalkthroughService } from './read-walkthrough-service.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
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
    }) => Effect.Effect<
      PostPlan,
      WalkthroughMessageNotFoundError | GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/PlanWalkthroughPostService') {
  static readonly layer = Layer.effect(
    PlanWalkthroughPostService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const current = yield* ReadWalkthroughService;
      return {
        execute: Effect.fn('PlanWalkthroughPostService.execute')(
          function* (input) {
            const { readyRuns } = yield* current.execute(input);
            const runIds = new Set(readyRuns.map((run) => run.id));
            const messages = (yield* store.listMessages(
              input.worktreeId,
            )).filter((message) => runIds.has(message.runId));
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
