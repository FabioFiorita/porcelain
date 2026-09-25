import { ConnectionError } from '../shared/api/connection-error';
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
import type { Api } from './api';
import { onUnauthorized } from '../shared/api/unauthorized';
import type { Inventory } from '@/features/projects/index';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { retainedFileDrafts } from '@/shared/query/file-drafts';
import { queryKeys } from '@/shared/query/keys';
import { connectLiveQueries } from '@/shared/query/live-updates';
import {
  createOperationStore,
  type OperationStore,
} from '@/shared/query/operation-store';

type ConnectedRequest = { signal: AbortSignal };
type Connection = {
  environmentId: string;
  controller: AbortController;
  operations: OperationStore;
  request: (signal?: AbortSignal) => ConnectedRequest;
};

function createConnection(environmentId: string): Connection {
  const controller = new AbortController();
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {}
  return {
    environmentId,
    controller,
    operations: createOperationStore(
      storage
        ? { storage, key: `porcelain-git-requests:${environmentId}` }
        : undefined,
    ),
    request: (signal) => ({
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
  restoring: boolean;
  beginConnection: (
    automatic?: boolean,
  ) => ((inventory: Inventory) => boolean) | null;
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
  const [restoring, setRestoring] = useState(true);
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
  const generation = useRef(0);
  const beginConnection = useCallback(
    (automatic = false) => {
      if (automatic && generation.current !== 0) return null;
      const attempt = generation.current;
      return (inventory: Inventory) => {
        if (attempt !== generation.current) return false;
        generation.current += 1;
        queryClient.clear();
        queryClient.setQueryData(
          queryKeys.inventory(inventory.environmentId),
          inventory,
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.inventory(inventory.environmentId),
        });
        setConnection(createConnection(inventory.environmentId));
        setRestoring(false);
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
      await api.session.disconnect();
      connection?.operations.clear();
      connection?.controller.abort();
      void queryClient.cancelQueries();
      queryClient.clear();
      setConnection(null);
      setRestoring(false);
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
  useEffect(
    () =>
      onUnauthorized(() => {
        generation.current += 1;
        setRestoring(false);
        setConnection((current) => {
          current?.operations.clear();
          current?.controller.abort();
          return null;
        });
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  useEffect(() => {
    if (window.location.pathname === '/pair') {
      setRestoring(false);
      return;
    }
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
        complete(inventory);
      } catch {
      } finally {
        if (!controller.signal.aborted) setRestoring(false);
      }
    };
    void restore();
    return () => controller.abort();
  }, [api, beginConnection]);
  const value = useMemo(
    () => ({
      api,
      connection,
      restoring,
      beginConnection,
      disconnect,
      disconnectError,
      disconnectPending,
    }),
    [
      api,
      connection,
      restoring,
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
