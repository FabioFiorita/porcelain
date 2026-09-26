import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import {
  requireChangesConnection,
  type ChangesConnection,
  type ChangesScope,
} from '../rules/changes';

export function useChangeLines(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
  path: string,
  from: number,
  to: number,
  enabled: boolean,
) {
  const connection = requireChangesConnection(possibleConnection);
  return useQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'step-lines',
      path,
      from,
      to,
    ]),
    enabled,
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const result = await changesApi.lines(
        request.signal,
        scope.worktreeId,
        path,
        from,
        to,
        'worktree',
      );
      request.signal.throwIfAborted();
      return result;
    },
    throwOnError: false,
  });
}
