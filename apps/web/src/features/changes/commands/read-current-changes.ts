import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '../queries/changes';
import { gitStatusQueryOptions } from '../queries/git-status';
import type { ChangesScope } from '../rules/changes';
import {
  type Connection,
  requireConnection,
} from '@/shared/workspace/connection';

export function useReadCurrentChanges(
  scope: ChangesScope,
  possibleConnection: Connection | null,
) {
  const client = useQueryClient();
  const connection = requireConnection(possibleConnection);
  const options = changesQueryOptions(scope, connection);
  return async () =>
    (await client.fetchQuery({ ...options, staleTime: 0 })).changes;
}

export function useRefreshGitLook(
  scope: ChangesScope,
  possibleConnection: Connection | null,
) {
  const readChanges = useReadCurrentChanges(scope, possibleConnection);
  const client = useQueryClient();
  const connection = requireConnection(possibleConnection);
  return async () => {
    const changes = await readChanges();
    await client.invalidateQueries({
      queryKey: gitStatusQueryOptions(scope, connection).queryKey,
      exact: true,
    });
    return changes;
  };
}
