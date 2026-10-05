import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { reviewsApi } from '../api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { layerMarksQueryOptions } from '../queries/reviewed.ts';

export function toggleLayerMark(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
  input: { layerId: string; fingerprint: string; reviewed: boolean },
) {
  return Effect.gen(function* () {
    const request = { ...scope, ...connection.request() };
    const api = reviewsApi(connection);
    const result = yield* requestEffect(
      input.reviewed
        ? api.removeReviewedLayer({
            params: { worktreeId: scope.worktreeId },
            query: { layerId: input.layerId },
          })
        : api.setReviewedLayer({
            params: { worktreeId: scope.worktreeId },
            payload: {
              layerId: input.layerId,
              fingerprint: input.fingerprint,
              reviewed: true,
            },
          }),
      request.signal,
    );
    yield* currentAnswerEffect(
      request.signal,
      result.worktreeId === scope.worktreeId,
    );
    client.setQueryData(
      layerMarksQueryOptions(scope, connection).queryKey,
      result,
    );
    yield* nativeOperation(() =>
      client.invalidateQueries({
        queryKey: queryKeys.inventory(connection.environmentId),
      }),
    );
    return result;
  });
}
