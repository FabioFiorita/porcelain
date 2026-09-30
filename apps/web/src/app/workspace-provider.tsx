import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { workspaceContext, type WorkspaceContext } from './boot';
import { onUnauthorized } from '../shared/api/unauthorized';
import {
  type Connection,
  useAccessStore,
  useRemoteConnections,
} from '@/features/access/index';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { connectLiveQueries } from '@/shared/query/live-updates';
import { desktopShell } from '@/shared/shell';

const Context = createContext<{ local: WorkspaceContext | null } | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const connection = useAccessStore((state) => state.connection);
  const remotes = useRemoteConnections();
  useEffect(() => {
    if (!connection) return;
    const connections = [
      connection,
      ...remotes.map((remote) => remote.connection),
    ];
    const leaving = (event: BeforeUnloadEvent) => {
      if (
        connections.some((open) =>
          [...retainedFileDrafts(open).values()].some((draft) => {
            const state = draft.snapshot();
            return state.saving || state.text !== state.savedText;
          }),
        )
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [connection, remotes]);
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(
      workspaceContext(connection).api,
      queryClient,
      connection,
    );
  }, [connection, queryClient]);
  useEffect(() => {
    if (!connection || !desktopShell) return;
    const stops = remotes.map((remote) =>
      connectLiveQueries(
        workspaceContext(remote.connection).api,
        queryClient,
        remote.connection,
      ),
    );
    return () => {
      for (const stop of stops) stop();
    };
  }, [connection, remotes, queryClient]);
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
    <Context
      value={{ local: connection ? workspaceContext(connection) : null }}
    >
      {children}
    </Context>
  );
}

function useLocalContext() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context.local;
}

export function useConnectedContext(remote?: Connection) {
  const local = useLocalContext();
  if (remote) return workspaceContext(remote);
  if (!local) throw new Error('A connected environment is required');
  return local;
}
