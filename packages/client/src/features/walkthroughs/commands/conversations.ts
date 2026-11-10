import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type { AddWalkthroughMessageRequest } from '@porcelain/contracts/walkthroughs';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

export const walkthroughConversationCommands = Atom.family(
  ({ connection, scope }: WorktreeSelection) => {
    const runtime = clientRuntime(connection);
    const worktree = { worktreeId: scope.worktreeId };
    const invalidate = Reactivity.invalidate([
      queryKeys.reviewSurface(connection.environmentId, scope, [
        'walkthrough-conversations',
      ]),
    ]);
    const message = (messageId: string) => ({ ...worktree, messageId });
    return {
      addMessage: runtime.fn(
        Effect.fn('Walkthroughs.addMessage')(function* (
          payload: AddWalkthroughMessageRequest,
        ) {
          const view = yield* requestApi(connection, (api) =>
            api.walkthroughs.addWalkthroughMessage({
              params: worktree,
              payload,
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      retryAnswer: runtime.fn(
        Effect.fn('Walkthroughs.retryAnswer')(function* (messageId: string) {
          const view = yield* requestApi(connection, (api) =>
            api.walkthroughs.retryWalkthroughAnswer({
              params: message(messageId),
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      saveMessage: runtime.fn(
        Effect.fn('Walkthroughs.saveMessage')(function* (input: {
          messageId: string;
          saved: boolean;
        }) {
          const view = yield* requestApi(connection, (api) =>
            api.walkthroughs.saveWalkthroughMessage({
              params: message(input.messageId),
              payload: { saved: input.saved },
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      postMessage: runtime.fn(
        Effect.fn('Walkthroughs.postMessage')(function* (messageId: string) {
          const answer = yield* requestApi(connection, (api) =>
            api.walkthroughs.postWalkthroughMessage({
              params: message(messageId),
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      readBrief: runtime.fn(
        Effect.fn('Walkthroughs.readBrief')(function* (
          messageId: string | undefined,
        ) {
          const answer = yield* requestApi(connection, (api) =>
            api.walkthroughs.readWalkthroughBrief({
              params: worktree,
              query: messageId === undefined ? {} : { messageId },
            }),
          );
          return answer.text;
        }),
      ),
      postSavedMessages: runtime.fn(
        Effect.fn('Walkthroughs.postSavedMessages')(function* () {
          const answer = yield* requestApi(connection, (api) =>
            api.walkthroughs.postSavedWalkthroughMessages({ params: worktree }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
    };
  },
);
