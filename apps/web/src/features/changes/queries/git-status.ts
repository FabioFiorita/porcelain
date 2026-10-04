import { assertCurrentAnswer } from '@porcelain/client/transport';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@porcelain/client/transport';
import { changesApi } from '../api';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

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
      const data = await changesApi(connection).status({
        signal: request.signal,
        worktreeId: scope.worktreeId,
      });
      assertCurrentAnswer(request.signal);
      return data;
    },
  });
}

export function useGitStatus(
  scope: ChangesScope,
  connection: Connection,
  enabled = true,
) {
  const query = useQuery({
    ...gitStatusQueryOptions(scope, connection),
    enabled,
    throwOnError: false,
  });
  return {
    status: query.data,
    pending: enabled && query.isPending,
    read: async () => (await query.refetch()).data,
  };
}
