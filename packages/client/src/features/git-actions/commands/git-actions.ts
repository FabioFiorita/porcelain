import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import type { QueryClient } from '@tanstack/query-core';
import type { GenerateCommitDraftRequest } from '@porcelain/contracts/git-actions';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { gitActionsApi } from '../api.ts';

export function gitActionCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = gitActionsApi(connection);
  const request = () => ({
    ...scope,
    ...connection.request(),
  });
  return {
    draft: (input: GenerateCommitDraftRequest) =>
      Effect.gen(function* () {
        const connected = request();
        const result = yield* requestEffect(
          api.generateCommitDraft({
            params: { worktreeId: scope.worktreeId },
            payload: input,
          }),
          connected.signal,
        );
        yield* currentAnswerEffect(connected.signal);
        return result;
      }),
    dismiss: (requestId: string) =>
      Effect.gen(function* () {
        const connected = request();
        yield* requestEffect(
          api.dismissInterruptedGitAction({
            params: { worktreeId: scope.worktreeId, requestId },
          }),
          connected.signal,
        );
        yield* currentAnswerEffect(connected.signal);
        yield* nativeOperation(() =>
          client.invalidateQueries({
            queryKey: queryKeys.worktreeSurface(connection, scope, ['changes']),
            exact: true,
          }),
        );
      }),
  };
}
