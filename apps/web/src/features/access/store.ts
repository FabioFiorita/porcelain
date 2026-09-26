import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { create } from 'zustand';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import {
  createOperationStore,
  type OperationStore,
} from '@/shared/query/operation-store';

type Connection = {
  environmentId: string;
  controller: AbortController;
  operations: OperationStore;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
};

type AccessState = {
  connection: Connection | null;
  generation: number;
  restoring: boolean;
  connect: (environmentId: string) => Connection;
  beginConnection: (
    automatic?: boolean,
  ) => ((inventory: ReadInventoryResponse) => boolean) | null;
  setRestoring: (restoring: boolean) => void;
  clear: () => void;
};

function createConnection(environmentId: string): Connection {
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = undefined;
  }
  const controller = new AbortController();
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

export const useAccessStore = create<AccessState>()((set, get) => ({
  connection: null,
  generation: 0,
  restoring: true,
  connect(environmentId) {
    const current = get().connection;
    if (current?.environmentId === environmentId) return current;
    current?.operations.clear();
    current?.controller.abort();
    const connection = createConnection(environmentId);
    set({ connection, restoring: false });
    return connection;
  },
  beginConnection(automatic = false) {
    if (automatic && get().generation !== 0) return null;
    const attempt = get().generation;
    return (inventory) => {
      if (attempt !== get().generation) return false;
      set({ generation: attempt + 1 });
      get().connect(inventory.environmentId);
      return true;
    };
  },
  setRestoring(restoring) {
    set({ restoring });
  },
  clear() {
    const current = get().connection;
    current?.operations.clear();
    current?.controller.abort();
    set((state) => ({
      connection: null,
      generation: state.generation + 1,
      restoring: false,
    }));
  },
}));

export function useConnection() {
  const connected = useAccessStore((state) => state.connection !== null);
  const restoring = useAccessStore((state) => state.restoring);
  return { connected, restoring };
}
