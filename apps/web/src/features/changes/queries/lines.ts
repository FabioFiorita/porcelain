import { assertCurrentAnswer } from '@porcelain/client/transport';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@porcelain/client/transport';
import { changesApi } from '../api';
import { type ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useChangeLines(
  scope: ChangesScope,
  possibleConnection: Connection,
  path: string,
  from: number,
  to: number,
  enabled: boolean,
) {
  const connection = possibleConnection;
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
      assertCurrentAnswer(request.signal);
      return result;
    },
    throwOnError: false,
  });
}
