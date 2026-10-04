import { useQueryClient } from '@tanstack/react-query';
import { readCurrentChanges } from '@porcelain/client/changes';
import { gitStatusQueryOptions } from '../queries/git-status';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useReadCurrentChanges(
  scope: ChangesScope,
  possibleConnection: Connection,
) {
  const client = useQueryClient();
  const connection = possibleConnection;
  return () => readCurrentChanges(scope, connection, client);
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
