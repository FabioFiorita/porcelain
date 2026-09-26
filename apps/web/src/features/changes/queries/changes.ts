import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
} from '../rules/changes';

export function changesQueryOptions(
  scope: ChangesScope,
  connection: ChangesConnection,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const changes = await changesApi.list(request.signal, scope.worktreeId);
      request.signal.throwIfAborted();
      if (
        changes.environmentId !== connection.environmentId ||
        changes.worktreeId !== scope.worktreeId
      )
        throw new ConnectionError(
          'The review context changed. Reopen Porcelain to continue safely.',
        );
      return { changes };
    },
  });
}

export function useChanges(
  scope: ChangesScope,
  connection: ChangesConnection | null,
) {
  return useSuspenseQuery(
    changesQueryOptions(scope, requireChangesConnection(connection)),
  ).data;
}

export function useReviewOverview(
  scope: ChangesScope,
  connection: ChangesConnection | null,
) {
  return useQuery({
    ...changesQueryOptions(scope, requireChangesConnection(connection)),
    throwOnError: false,
  }).data;
}
