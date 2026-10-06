import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import { withSignal } from '@porcelain/effects';
import type { GenerateCommitDraftRequest } from '@porcelain/contracts/git-actions';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

type Selection = {
  readonly connection: RuntimeConnection;
  readonly scope: WorktreeScope;
};
export const generateCommitDraft = Atom.family(
  ({ connection, scope }: Selection) =>
    clientRuntime(connection).fn(
      Effect.fn('GitActions.generateCommitDraft')(function* ({
        signal: caller,
        ...input
      }: GenerateCommitDraftRequest & { signal?: AbortSignal }) {
        const signal = connection.request(caller).signal;
        const api = yield* porcelainClient(connection);
        const result = yield* withSignal(
          requestEffect(
            api.gitActions.generateCommitDraft({
              params: { worktreeId: scope.worktreeId },
              payload: input,
            }),
          ),
          signal,
        );
        yield* currentAnswerEffect(signal);
        return result;
      }),
      { concurrent: true },
    ),
);
export const dismissInterruptedGitAction = Atom.family(
  ({ connection, scope }: Selection) =>
    clientRuntime(connection).fn(
      Effect.fn('GitActions.dismissInterrupted')(function* (requestId: string) {
        const api = yield* porcelainClient(connection);
        yield* requestEffect(
          api.gitActions.dismissInterruptedGitAction({
            params: { worktreeId: scope.worktreeId, requestId },
          }),
        );
        yield* currentAnswerEffect(connection.request().signal);
        yield* Reactivity.invalidate([
          queryKeys.reviewSurface(connection.environmentId, scope, ['changes']),
        ]);
      }),
    ),
);
