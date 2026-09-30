import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { onUnauthorized, reportUnauthorized } from '../shared/api/unauthorized';
import {
  remoteKey,
  remoteLiveOpen,
  useAccessStore,
  useRecheckRemote,
  useRemoteConnections,
  useRemoteStatus,
  type RemoteConnection,
} from '@/features/access/index';
import { readGitReceipt } from '@/features/git-actions/index';
import { hasUnsavedFileDrafts } from '@/shared/query/file-drafts';
import { connectLiveQueries } from '@/shared/query/live-updates';
import { desktopShell } from '@/shared/shell';
import type {
  Connection,
  ConnectionContext,
} from '@/shared/workspace/connection';

const Context = createContext<{ local: ConnectionContext | null } | null>(null);

function RemoteLive({ remote }: { remote: RemoteConnection }) {
  const queryClient = useQueryClient();
  const status = useRemoteStatus(remote.remote);
  const recheck = useRecheckRemote();
  const open = remoteLiveOpen(status, desktopShell);
  const { connection } = remote;
  const saved = remote.remote;
  useEffect(() => {
    if (!open) return;
    return connectLiveQueries(queryClient, connection, {
      readReceipt: (request) => readGitReceipt(connection, request),
      onUnauthorized: () => void recheck(saved),
    });
  }, [open, queryClient, connection, recheck, saved]);
  return null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const connection = useAccessStore((state) => state.connection);
  const remotes = useRemoteConnections();
  useEffect(() => {
    if (!connection) return;
    const environments = [
      connection.environmentId,
      ...remotes.map((remote) => remote.remote.environmentId),
    ];
    const leaving = (event: BeforeUnloadEvent) => {
      if (hasUnsavedFileDrafts(environments)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [connection, remotes]);
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(queryClient, connection, {
      readReceipt: (request) => readGitReceipt(connection, request),
      onUnauthorized: reportUnauthorized,
    });
  }, [connection, queryClient]);
  useEffect(
    () =>
      onUnauthorized(() => {
        useAccessStore.getState().clear();
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  return (
    <Context value={{ local: connection ? { connection } : null }}>
      {connection &&
        desktopShell &&
        remotes.map((remote) => (
          <RemoteLive key={remoteKey(remote.remote)} remote={remote} />
        ))}
      {children}
    </Context>
  );
}

function useLocalContext() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context.local;
}

export function useConnectedContext(remote?: Connection): ConnectionContext {
  const local = useLocalContext();
  if (remote) return { connection: remote };
  if (!local) throw new Error('A connected environment is required');
  return local;
}
