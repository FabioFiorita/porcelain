import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ConnectionError } from '@porcelain/client/transport';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function changesQueryOptions(
  scope: ChangesScope,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const changes = await changesApi(connection).list(
        request.signal,
        scope.worktreeId,
      );
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

export function useChanges(scope: ChangesScope, connection: Connection | null) {
  return useSuspenseQuery(
    changesQueryOptions(scope, requireConnection(connection)),
  ).data;
}

export function useReviewOverview(
  scope: ChangesScope,
  connection: Connection | null,
) {
  return useQuery({
    ...changesQueryOptions(scope, requireConnection(connection)),
    throwOnError: false,
  }).data;
}
