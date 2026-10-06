import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { QueryClient } from '@tanstack/query-core';
import type { SetFilePreferenceRequest } from '@porcelain/contracts/projects';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { WriteQueues } from '../../../shared/api/write-queue.ts';
import { projectsApi } from '../api.ts';
import { filePreferencesQueryOptions } from '../queries/file-preferences.ts';

export function setFilePreference(
  connection: WorktreeConnection,
  client: QueryClient,
  projectId: string,
  input: SetFilePreferenceRequest,
) {
  const key = filePreferencesQueryOptions(connection, projectId).queryKey;
  return WriteQueues.use((queues) =>
    queues.run(
      key,
      Effect.gen(function* () {
        const request = connection.request();
        const result = yield* requestEffect(
          projectsApi(connection).setFilePreference({
            params: { projectId },
            payload: input,
          }),
          request.signal,
        );
        yield* currentAnswerEffect(request.signal);
        yield* nativeOperation(() =>
          client.cancelQueries({ queryKey: key, exact: true }),
        );
        yield* currentAnswerEffect(request.signal);
        client.setQueryData(key, result);
        return result;
      }),
    ),
  );
}
