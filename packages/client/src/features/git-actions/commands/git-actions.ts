import type { QueryClient } from '@tanstack/query-core';
import type {
  GenerateCommitDraftRequest,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { gitActionsApi } from '../api.ts';

export function gitActionCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = gitActionsApi(connection);
  const request = (signal?: AbortSignal) => ({
    ...scope,
    ...connection.request(signal),
  });
  return {
    run: async (input: RunGitActionRequest) => {
      const connected = request();
      const receipt = await api.run({ ...connected, input });
      const matches =
        receipt.projectId === scope.projectId &&
        receipt.worktreeId === scope.worktreeId &&
        receipt.requestId === input.requestId &&
        receipt.action === input.input.action;
      assertCurrentAnswer(connected.signal, matches);
      return receipt;
    },
    draft: async (input: GenerateCommitDraftRequest, signal?: AbortSignal) => {
      const connected = request(signal);
      const result = await api.draft({ ...connected, input });
      assertCurrentAnswer(connected.signal);
      return result;
    },
    dismiss: async (requestId: string) => {
      const connected = request();
      await api.dismissInterrupted({ ...connected, requestId });
      assertCurrentAnswer(connected.signal);
      await client.invalidateQueries({
        queryKey: queryKeys.worktreeSurface(connection, scope, ['changes']),
        exact: true,
      });
    },
  };
}
