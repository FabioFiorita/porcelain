import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughConversationsView } from '../models/conversation.ts';
import { conversationsView } from '../rules/conversations.ts';
export class ListWalkthroughConversationsService extends Context.Service<
  ListWalkthroughConversationsService,
  {
    readonly execute: (input: {
      worktreeId: string;
    }) => Effect.Effect<WalkthroughConversationsView>;
  }
>()('@porcelain/walkthroughs/ListWalkthroughConversationsService') {
  static readonly layer = Layer.effect(
    ListWalkthroughConversationsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      return {
        execute: Effect.fn('ListWalkthroughConversationsService.execute')(
          function* (input) {
            const [runs, messages] = yield* Effect.all([
              store.listReadyRuns(input.worktreeId),
              store.listMessages(input.worktreeId),
            ]);
            return conversationsView(runs, messages);
          },
        ),
      };
    }),
  );
}
