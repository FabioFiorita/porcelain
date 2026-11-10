import { ReadWalkthroughTargetService } from './read-walkthrough-target-service.ts';
import { Context, Effect, Layer } from 'effect';
import type { WalkthroughTargetNotFoundError } from '../errors/walkthrough-target-not-found-error.ts';
import type { WalkthroughConversationsView } from '../models/conversation.ts';
import { conversationsView } from '../rules/conversations.ts';
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
      return {
        execute: Effect.fn('ListWalkthroughConversationsService.execute')(
          function* (input) {
            const { readyRuns, messages } = yield* current.execute(input);
            return conversationsView(readyRuns, messages);
          },
        ),
      };
    }),
  );
}
