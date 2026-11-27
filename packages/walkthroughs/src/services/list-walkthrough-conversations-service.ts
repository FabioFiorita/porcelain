import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import type { WalkthroughConversationsView } from '../models/conversation.ts';
import { conversationsView } from '../rules/conversations.ts';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
export class ListWalkthroughConversationsService extends Context.Service<
  ListWalkthroughConversationsService,
  {
    readonly execute: (input: {
      worktreeId: string;
      runId: string;
    }) => Effect.Effect<
      WalkthroughConversationsView,
      WalkthroughTargetNotFoundError
    >;
  }
>()('@porcelain/walkthroughs/ListWalkthroughConversationsService') {
  static readonly layer = Layer.effect(
    ListWalkthroughConversationsService,
    Effect.gen(function* () {
      const current = yield* ReadWalkthroughTargetService;
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ListWalkthroughConversationsService.execute')(
          function* (input) {
            const { readyRuns, messages } = yield* current.execute(input);
            const decisions = yield* store.listDecisions(
              input.worktreeId,
              input.runId,
            );
            return conversationsView(readyRuns, messages, decisions);
          },
        ),
      };
    }),
  );
}
