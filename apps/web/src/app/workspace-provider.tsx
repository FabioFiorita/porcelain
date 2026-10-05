import { remoteKey } from '@porcelain/client/access/rules';
import type { ReactNode } from 'react';
import {
  remoteLiveOpen,
  useLocalConnection,
  useRestoreEnvironments,
  useRecheckRemote,
  useRemoteConnections,
  useRemoteStatus,
  useSignOutWhenUnauthorized,
  type RemoteConnection,
} from '@/features/access/index';
import { useUnsavedDraftsGuard } from '@/features/files/index';
import { useLiveQueries } from '@/features/live/index';
import { desktopShell } from '@/shared/shell';

function RemoteLive({ remote }: { remote: RemoteConnection }) {
  const status = useRemoteStatus(remote.remote);
  const recheck = useRecheckRemote();
  const open = remoteLiveOpen(status, desktopShell);
  const saved = remote.remote;
  useLiveQueries(open ? remote.connection : null, () => void recheck(saved));
  return null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  useRestoreEnvironments();
  const connection = useLocalConnection();
  const remotes = useRemoteConnections();
  useUnsavedDraftsGuard(
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
          <RemoteLive key={remoteKey(remote.remote)} remote={remote} />
        ))}
      {children}
    </>
  );
}
