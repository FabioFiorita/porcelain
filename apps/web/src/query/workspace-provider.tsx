import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Api } from '../api/api';
import type { Inventory } from '../domain/inventory';
import { REQUEST_TIMEOUT_MS } from '../lib/request-timeout';
import { retainedFileDrafts } from './file-drafts';
import { queryKeys } from './keys';
import { createOperationStore, type OperationStore } from './operation-store';

type ConnectedRequest = { token: string; signal: AbortSignal };
type Connection = {
  token: string;
  environmentId: string;
  controller: AbortController;
  operations: OperationStore;
  request: (signal?: AbortSignal) => ConnectedRequest;
};

function createConnection(token: string, environmentId: string): Connection {
  const controller = new AbortController();
  return {
    token,
    environmentId,
    controller,
    operations: createOperationStore(),
    request: (signal) => ({
      token,
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(signal ? [signal] : []),
      ]),
    }),
  };
}

type WorkspaceContext = {
  api: Api;
  connection: Connection | null;
  beginConnection: (
    automatic?: boolean,
  ) => ((token: string, inventory: Inventory) => boolean) | null;
  disconnect: () => Promise<void>;
  disconnectError: Error | null;
  disconnectPending: boolean;
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
  const [disconnectError, setDisconnectError] = useState<Error | null>(null);
  const [disconnectPending, setDisconnectPending] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
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
  // Lifecycle identity: every successful connection/disconnect invalidates older attempts.
  const generation = useRef(0);
  const beginConnection = useCallback(
    (automatic = false) => {
      if (automatic && generation.current !== 0) return null;
      const attempt = generation.current;
      return (token: string, inventory: Inventory) => {
        if (attempt !== generation.current) return false;
        generation.current += 1;
        queryClient.clear();
        queryClient.setQueryData(
          queryKeys.inventory(inventory.environmentId),
          inventory,
        );
        // Login and session restore return the server's stored snapshot
        // without rescanning. Mark the seed stale so the workspace rescans on
        // mount; otherwise a page reload can never discover a new worktree.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inventory(inventory.environmentId),
        });
        setConnection(createConnection(token, inventory.environmentId));
        return true;
      };
    },
    [queryClient],
  );
  const disconnect = useCallback(async () => {
    generation.current += 1;
    setDisconnectPending(true);
    setDisconnectError(null);
    try {
      if (connection)
        for (const draft of retainedFileDrafts(connection).values())
          if (!(await draft.save()))
            throw new ConnectionError(
              'Save or discard unsaved file drafts before disconnecting.',
            );
      if (!import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE)
        await api.session.disconnect();
      connection?.controller.abort();
      void queryClient.cancelQueries();
      queryClient.clear();
      setConnection(null);
    } catch (error) {
      setDisconnectError(
        error instanceof ConnectionError
          ? error
          : new ConnectionError(
              'Could not disconnect. Check the connection and try again.',
            ),
      );
    } finally {
      setDisconnectPending(false);
    }
  }, [api, connection, queryClient]);
  // Restore through the API so private data is never shown before authentication.
  useEffect(() => {
    if (import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE) return;
    const complete = beginConnection(true);
    if (!complete) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]);
    const restore = async () => {
      try {
        const inventory = await api.session.restore(signal);
        signal.throwIfAborted();
        complete('browser-session', inventory);
      } catch {
        // Expired sessions and temporary outages leave manual login available.
      }
    };
    void restore();
    return () => controller.abort();
  }, [api, beginConnection]);
  // Stable context identity prevents unrelated provider renders from notifying every hook.
  const value = useMemo(
    () => ({
      api,
      connection,
      beginConnection,
      disconnect,
      disconnectError,
      disconnectPending,
    }),
    [
      api,
      connection,
      beginConnection,
      disconnect,
      disconnectError,
      disconnectPending,
    ],
  );
  return <Context value={value}>{children}</Context>;
}

export function useWorkspaceContext() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context;
}

export function useConnectedContext() {
  const { api, connection } = useWorkspaceContext();
  if (!connection) throw new Error('A connected environment is required');
  return { api, connection };
}
