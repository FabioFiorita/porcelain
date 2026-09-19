import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { Api } from '../api/api';
import {
  type ConnectionStore,
  createConnectionStore,
} from './connection-store';
import { createOperationStore, type OperationStore } from './operation-store';

type WorkspaceContext = {
  api: Api;
  environmentId: string;
  operations: OperationStore;
  connection: ConnectionStore;
};

const Context = createContext<WorkspaceContext | null>(null);

/**
 * The web app talks to the one server that serves it, so there is one api, one
 * environment, one live channel and one pairing state. The device token lives in
 * an HttpOnly cookie, so nothing here holds a secret.
 */
export function WorkspaceProvider({
  api,
  environmentId,
  connection,
  children,
}: {
  api: Api;
  environmentId: string;
  connection?: ConnectionStore;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      api,
      environmentId,
      operations: createOperationStore(),
      connection: connection ?? createConnectionStore(),
    }),
    [api, environmentId, connection],
  );
  return <Context value={value}>{children}</Context>;
}

export function useWorkspaceContext(): WorkspaceContext {
  const context = useContext(Context);
  if (context == null) throw new Error('WorkspaceProvider is required');
  return context;
}
