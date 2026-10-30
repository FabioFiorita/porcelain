import type { RemoteConnection } from '@porcelain/client/access';
import type { ReactNode } from 'react';
import {
  useLocalConnection,
  useRestoreEnvironments,
  useRemoteConnections,
  useSignOutWhenUnauthorized,
} from '@/features/access/index';
import { useUnsavedDraftsGuard } from '@/features/files/index';
import { useLiveQueries } from '@/features/live/index';
import { desktopShell } from '@/shared/shell';

function RemoteLive({ remote }: { remote: RemoteConnection }) {
  useLiveQueries(remote.connection);
  return null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  useRestoreEnvironments();
  const connection = useLocalConnection();
  const remotes = useRemoteConnections();
  useUnsavedDraftsGuard(
    connection,
    connection
      ? [
          connection.environmentId,
          ...remotes.map((remote) => remote.remote.environmentId),
        ]
      : [],
  );
  const reportUnauthorized = useSignOutWhenUnauthorized();
  useLiveQueries(connection, reportUnauthorized);
  return (
    <>
      {connection &&
        desktopShell &&
        remotes.map((remote) => (
          <RemoteLive key={remote.remote.environmentId} remote={remote} />
        ))}
      {children}
    </>
  );
}
