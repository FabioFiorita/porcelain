import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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
  disconnect: () => void;
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
  const disconnect = useCallback(() => {
    generation.current += 1;
    connection?.controller.abort();
    void queryClient.cancelQueries();
    queryClient.clear();
    setConnection(null);
  }, [connection, queryClient]);
  // Stable context identity prevents unrelated provider renders from notifying every hook.
  const value = useMemo(
    () => ({ api, connection, beginConnection, disconnect }),
    [api, connection, beginConnection, disconnect],
  );
  return <Context value={value}>{children}</Context>;
}

export function useWorkspaceContext() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider is required');
  return context;
}
