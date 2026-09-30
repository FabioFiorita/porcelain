import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { savedJson } from '@/shared/lib/saved-json';
import { parseRemotes, withRemote, type Remote } from './rules/remotes';
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
  connect: (environmentId: string) => Connection;
  beginConnection: (
    automatic?: boolean,
  ) => ((inventory: ReadInventoryResponse) => boolean) | null;
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
  connect(environmentId) {
    const current = get().connection;
    if (current?.environmentId === environmentId) return current;
    current?.operations.clear();
    current?.controller.abort();
    const connection = createConnection(environmentId);
    set({ connection });
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
  clear() {
    const current = get().connection;
    current?.operations.clear();
    current?.controller.abort();
    set((state) => ({
      connection: null,
      generation: state.generation + 1,
    }));
  },
}));

type RemotesState = {
  remotes: Remote[];
  save: (remote: Remote) => void;
  forget: (environmentId: string) => void;
};

export const useRemotesStore = create<RemotesState>()(
  persist<RemotesState, [], [], Remote[]>(
    (set, get) => ({
      remotes: [],
      save: (remote) => set({ remotes: withRemote(get().remotes, remote) }),
      forget: (environmentId) =>
        set({
          remotes: get().remotes.filter(
            (remote) => remote.environmentId !== environmentId,
          ),
        }),
    }),
    {
      name: 'porcelain.remotes',
      storage: savedJson(() => localStorage, parseRemotes),
      partialize: ({ remotes }) => remotes,
      merge: (saved, current) => ({ ...current, remotes: parseRemotes(saved) }),
    },
  ),
);
