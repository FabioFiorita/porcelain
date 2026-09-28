import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import type { Api } from './api';
import { onUnauthorized } from '../shared/api/unauthorized';
import { useAccessStore } from '@/features/access/index';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { connectLiveQueries } from '@/shared/query/live-updates';

type WorkspaceContext = {
  api: Api;
  connection: ReturnType<typeof useAccessStore.getState>['connection'];
};
const Context = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({
  api,
  children,
}: {
  api: Api;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const connection = useAccessStore((state) => state.connection);
  useEffect(() => {
    if (!connection) return;
    const leaving = (event: BeforeUnloadEvent) => {
      if (
        [...retainedFileDrafts(connection).values()].some((draft) => {
          const state = draft.snapshot();
          return state.saving || state.text !== state.savedText;
        })
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leaving);
    return () => window.removeEventListener('beforeunload', leaving);
  }, [connection]);
  useEffect(() => {
    if (!connection) return;
    return connectLiveQueries(api, queryClient, connection);
  }, [api, connection, queryClient]);
  useEffect(
    () =>
      onUnauthorized(() => {
        useAccessStore.getState().clear();
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  return <Context value={{ api, connection }}>{children}</Context>;
}

function useWorkspaceContext() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context;
}

export function useConnectedContext() {
  const { api, connection } = useWorkspaceContext();
  if (!connection) throw new Error('A connected environment is required');
  return { api, connection };
}
