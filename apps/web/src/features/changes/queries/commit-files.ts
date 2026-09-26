import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
} from '../rules/changes';

function commitFilesQueryOptions(
  scope: ChangesScope,
  connection: ChangesConnection,
  oid: string,
  parent = 1,
) {
  return queryOptions({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'commit',
      oid,
      parent,
    ]),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const result = await changesApi.commit(
        request.signal,
        scope.worktreeId,
        oid,
        parent,
      );
      request.signal.throwIfAborted();
      return result;
    },
  });
}

export function useCommit(
  scope: ChangesScope,
  connection: ChangesConnection | null,
  oid: string,
  parent = 1,
) {
  return useSuspenseQuery(
    commitFilesQueryOptions(
      scope,
      requireChangesConnection(connection),
      oid,
      parent,
    ),
  ).data;
}
