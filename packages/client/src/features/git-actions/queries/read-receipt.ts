import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { Effect } from 'effect';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { gitActionsApi } from '../api.ts';

export function readGitReceipt(
  connection: WorktreeConnection,
  request: {
    projectId: string;
    worktreeId: string;
    requestId: string;
    signal: AbortSignal;
  },
) {
  const { signal } = connection.request(request.signal);
  return requestEffect(
    Effect.gen(function* () {
      const receipt = yield* gitActionsApi(connection).readGitActionReceipt({
        params: {
          worktreeId: request.worktreeId,
          requestId: request.requestId,
        },
      });
      yield* currentAnswerEffect(
        signal,
        receipt.projectId === request.projectId &&
          receipt.worktreeId === request.worktreeId &&
          receipt.requestId === request.requestId,
      );
      return receipt;
    }),
    signal,
  );
}
