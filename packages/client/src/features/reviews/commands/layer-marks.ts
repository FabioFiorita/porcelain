import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { reviewsApi } from '../api.ts';
import { layerMarksQueryOptions } from '../queries/reviewed.ts';

export async function toggleLayerMark(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
  input: { layerId: string; fingerprint: string; reviewed: boolean },
) {
  const request = { ...scope, ...connection.request() };
  const api = reviewsApi(connection).reviewedLayers;
  const result = input.reviewed
    ? await api.remove({ ...request, layerId: input.layerId })
    : await api.set({
        ...request,
        input: {
          layerId: input.layerId,
          fingerprint: input.fingerprint,
          reviewed: true,
        },
      });
  assertCurrentAnswer(request.signal, result.worktreeId === scope.worktreeId);
  client.setQueryData(
    layerMarksQueryOptions(scope, connection).queryKey,
    result,
  );
  await client.invalidateQueries({
    queryKey: queryKeys.inventory(connection.environmentId),
  });
  return result;
}
