import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { Effect } from 'effect';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { porcelainClient } from '../../../shared/api/client.ts';

export function readGitReceipt(
  connection: RuntimeConnection,
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
      const api = yield* porcelainClient(connection);
      const receipt = yield* api.gitActions.readGitActionReceipt({
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
