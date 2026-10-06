import type { QueryClient } from '@tanstack/query-core';
import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { WriteQueues } from '../../../shared/api/write-queue.ts';
import { accessApi } from '../api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';

export function renameEnvironment(
  connection: WorktreeConnection,
  client: QueryClient,
  name: string | null,
) {
  return WriteQueues.use((queues) =>
    queues.run(
      queryKeys.inventory(connection.environmentId),
      Effect.gen(function* () {
        const request = connection.request();
        yield* currentAnswerEffect(request.signal);
        const answer = yield* requestEffect(
          accessApi(connection).environmentName.renameEnvironment({
            payload: { name },
          }),
          request.signal,
        );
        yield* currentAnswerEffect(request.signal);
        yield* nativeOperation(() =>
          client.invalidateQueries({
            queryKey: queryKeys.inventory(connection.environmentId),
          }),
        );
        return answer;
      }),
    ),
  );
}
