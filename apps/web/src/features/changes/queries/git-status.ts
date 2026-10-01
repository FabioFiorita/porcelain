import { queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function gitStatusQueryOptions(
  scope: ChangesScope,
  connection: Connection,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'git-status',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await changesApi(connection).status(
        request.signal,
        scope.worktreeId,
      );
      request.signal.throwIfAborted();
      return data;
    },
  });
}

export function useGitStatus(
  scope: ChangesScope,
  connection: Connection | null,
  enabled = true,
) {
  const query = useQuery({
    ...gitStatusQueryOptions(scope, requireConnection(connection)),
    enabled,
    throwOnError: false,
  });
  return {
    status: query.data,
    pending: enabled && query.isPending,
    read: async () => (await query.refetch()).data,
  };
}
