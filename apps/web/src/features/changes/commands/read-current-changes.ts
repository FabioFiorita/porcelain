import { useQueryClient } from '@tanstack/react-query';
import { changesQueryOptions } from '../queries/changes';
import { gitStatusQueryOptions } from '../queries/git-status';
import type { ChangesConnection, ChangesScope } from '../rules/changes';
import { requireChangesConnection } from '../rules/changes';

export function useReadCurrentChanges(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
) {
  const client = useQueryClient();
  const connection = requireChangesConnection(possibleConnection);
  const options = changesQueryOptions(scope, connection);
  return async () =>
    (await client.fetchQuery({ ...options, staleTime: 0 })).changes;
}

export function useRefreshGitLook(
  scope: ChangesScope,
  possibleConnection: ChangesConnection | null,
) {
  const readChanges = useReadCurrentChanges(scope, possibleConnection);
  const client = useQueryClient();
  const connection = requireChangesConnection(possibleConnection);
  return async () => {
    const changes = await readChanges();
    await client.invalidateQueries({
      queryKey: gitStatusQueryOptions(scope, connection).queryKey,
      exact: true,
    });
    return changes;
  };
}
