import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { changesQueryOptions } from '../queries/changes.ts';
import { gitStatusQueryOptions } from '../queries/git-status.ts';

export function readCurrentChanges(
  client: QueryClient,
  connection: WorktreeConnection,
  scope: WorktreeScope,
) {
  return Effect.map(
    nativeOperation(() =>
      client.query({ ...changesQueryOptions(scope, connection), staleTime: 0 }),
    ),
    (result) => result.changes,
  );
}

export function refreshGitLook(
  client: QueryClient,
  connection: WorktreeConnection,
  scope: WorktreeScope,
) {
  return Effect.tap(readCurrentChanges(client, connection, scope), () =>
    nativeOperation(() =>
      client.invalidateQueries({
        queryKey: gitStatusQueryOptions(scope, connection).queryKey,
        exact: true,
      }),
    ),
  );
}
