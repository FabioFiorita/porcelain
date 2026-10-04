import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '@porcelain/client/changes';
import { gitStatusQueryOptions } from '../queries/git-status';
import type { ChangesScope } from '../rules/changes';
import { type Connection } from '@/shared/workspace/connection';

export function useReadCurrentChanges(
  scope: ChangesScope,
  possibleConnection: Connection,
) {
  const client = useQueryClient();
  const connection = possibleConnection;
  const options = changesQueryOptions(scope, connection);
  return async () => (await client.query({ ...options, staleTime: 0 })).changes;
}

export function useRefreshGitLook(
  scope: ChangesScope,
  possibleConnection: Connection,
) {
  const readChanges = useReadCurrentChanges(scope, possibleConnection);
  const client = useQueryClient();
  const connection = possibleConnection;
  return async () => {
    const changes = await readChanges();
    await client.invalidateQueries({
      queryKey: gitStatusQueryOptions(scope, connection).queryKey,
      exact: true,
    });
    return changes;
  };
}
