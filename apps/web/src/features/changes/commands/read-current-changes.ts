import { runRequest } from '@porcelain/client/transport';
import { useQueryClient } from '@tanstack/react-query';
import { readCurrentChanges, refreshGitLook } from '@porcelain/client/changes';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useReadCurrentChanges(
  scope: ChangesScope,
  connection: Connection,
) {
  const client = useQueryClient();
  return () =>
    runRequest(
      readCurrentChanges(client, connection, scope),
      connection.request().signal,
    );
}

export function useRefreshGitLook(scope: ChangesScope, connection: Connection) {
  const client = useQueryClient();
  return () =>
    runRequest(
      refreshGitLook(client, connection, scope),
      connection.request().signal,
    );
}
