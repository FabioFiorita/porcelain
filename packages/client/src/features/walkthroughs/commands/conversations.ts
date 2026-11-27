import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  AddWalkthroughMessageRequest,
  DecideWalkthroughCallRequest,
} from '@porcelain/contracts/walkthroughs';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

export const walkthroughConversationCommands = Atom.family(
  ({ connection, scope, runId }: WorktreeSelection & { runId: string }) => {
    const runtime = clientRuntime(connection);
    const worktree = { worktreeId: scope.worktreeId, runId };
    const invalidate = Reactivity.invalidate([
      queryKeys.reviewSurface(connection.environmentId, scope, [
        'walkthrough-conversations',
      ]),
    ]);
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
              params: { ...worktree, messageId },
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      decideCall: runtime.fn(
        Effect.fn('Walkthroughs.decideCall')(function* (
          input: { step: number; call: number } & DecideWalkthroughCallRequest,
        ) {
          const { step, call, ...payload } = input;
          const view = yield* requestApi(connection, (api) =>
            api.walkthroughs.decideWalkthroughCall({
              params: { ...worktree, step, call },
              payload,
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
    };
  },
);
