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
import { queryKeys } from './keys';

type Connection = {
  token: string;
  environmentId: string;
  controller: AbortController;
};
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
        setConnection({
          token,
          environmentId: inventory.environmentId,
          controller: new AbortController(),
        });
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
      if (!import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE)
        await api.session.disconnect();
      connection?.controller.abort();
      void queryClient.cancelQueries();
      queryClient.clear();
      setConnection(null);
    } catch {
      setDisconnectError(
        new ConnectionError(
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
      AbortSignal.timeout(15_000),
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
