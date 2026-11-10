import { ReadWalkthroughService } from './read-walkthrough-service.ts';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Context, Effect, Layer } from 'effect';
import { WalkthroughStore } from '../ports/walkthrough-store.ts';
import type { WalkthroughConversationsView } from '../models/conversation.ts';
import { conversationsView } from '../rules/conversations.ts';
export class ListWalkthroughConversationsService extends Context.Service<
  ListWalkthroughConversationsService,
  {
    readonly execute: (input: {
      worktreeId: string;
    }) => Effect.Effect<
      WalkthroughConversationsView,
      GitIoFailure,
      WorktreeRead
    >;
  }
>()('@porcelain/walkthroughs/ListWalkthroughConversationsService') {
  static readonly layer = Layer.effect(
    ListWalkthroughConversationsService,
    Effect.gen(function* () {
      const store = yield* WalkthroughStore;
      const current = yield* ReadWalkthroughService;
      return {
        execute: Effect.fn('ListWalkthroughConversationsService.execute')(
          function* (input) {
            const { readyRuns } = yield* current.execute(input);
            const runIds = new Set(readyRuns.map((run) => run.id));
            const messages = (yield* store.listMessages(
              input.worktreeId,
            )).filter((message) => runIds.has(message.runId));
            return conversationsView(readyRuns, messages);
          },
        ),
      };
    }),
  );
}
