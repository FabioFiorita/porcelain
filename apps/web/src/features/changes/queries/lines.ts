import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/query/keys';
import { changesApi } from '../api';
import { type ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useChangeLines(
  scope: ChangesScope,
  possibleConnection: Connection | null,
  path: string,
  from: number,
  to: number,
  enabled: boolean,
) {
  const connection = requireConnection(possibleConnection);
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
      const result = await changesApi(connection).lines({
        signal: request.signal,
        worktreeId: scope.worktreeId,
        path,
        from,
        to,
        at: 'worktree',
      });
      request.signal.throwIfAborted();
      return result;
    },
    throwOnError: false,
  });
}
