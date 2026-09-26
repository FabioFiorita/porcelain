import { queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
} from '../rules/changes';

export function gitStatusQueryOptions(
  scope: ChangesScope,
  connection: ChangesConnection,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'git-status',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await changesApi.status(request.signal, scope.worktreeId);
      request.signal.throwIfAborted();
      return data;
    },
  });
}

export function useGitStatus(
  scope: ChangesScope,
  connection: ChangesConnection | null,
  enabled = true,
) {
  const query = useQuery({
    ...gitStatusQueryOptions(scope, requireChangesConnection(connection)),
    enabled,
    throwOnError: false,
  });
  return {
    status: query.data,
    pending: enabled && query.isPending,
    read: async () => (await query.refetch()).data,
  };
}
