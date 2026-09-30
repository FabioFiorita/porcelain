import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { savedJson } from '@/shared/lib/saved-json';
import { parseRemotes, withRemote, type Remote } from './rules/remotes';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { browserTransport, remoteTransport } from '@/shared/api/transport';
import type { LiveUpdatePort } from '@/shared/live/port';
import { remoteLiveUpdates, sameOriginLiveUpdates } from '@/shared/live/socket';
import {
  createOperationStore,
  type OperationStore,
} from '@/shared/query/operation-store';

export type Connection = {
  environmentId: string;
  controller: AbortController;
  operations: OperationStore;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  transport: typeof fetch;
  liveUpdates: LiveUpdatePort;
};

export type RemoteConnection = { remote: Remote; connection: Connection };

type Server = {
  transport: typeof fetch;
  liveUpdates: LiveUpdatePort;
  operationsKey: string;
};

type AccessState = {
  connection: Connection | null;
  remoteConnections: readonly RemoteConnection[];
  generation: number;
  connect: (environmentId: string) => Connection;
  beginConnection: (
    automatic?: boolean,
  ) => ((inventory: ReadInventoryResponse) => boolean) | null;
  clear: () => void;
};

function createConnection(environmentId: string, server: Server): Connection {
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
      storage ? { storage, key: server.operationsKey } : undefined,
    ),
    request: (signal) => ({
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(signal ? [signal] : []),
      ]),
    }),
    transport: server.transport,
    liveUpdates: server.liveUpdates,
  };
}

function localConnection(environmentId: string) {
  return createConnection(environmentId, {
    transport: browserTransport(fetch),
    liveUpdates: sameOriginLiveUpdates(),
    operationsKey: `porcelain-git-requests:${environmentId}`,
  });
}

function remoteConnection(remote: Remote): RemoteConnection {
  const transport = remoteTransport(remote.address, remote.credential);
  return {
    remote,
    connection: createConnection(remote.environmentId, {
      transport,
      liveUpdates: remoteLiveUpdates(remote.address, transport),
      operationsKey: `porcelain-git-requests:${remote.address}:${remote.environmentId}`,
    }),
  };
}

function close(connection: Connection) {
  connection.operations.clear();
  connection.controller.abort();
}

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

function sameRemote(left: Remote, right: Remote) {
  return (
    left.environmentId === right.environmentId &&
    left.address === right.address &&
    left.credential === right.credential
  );
}

function remoteConnections(
  remotes: readonly Remote[],
  current: readonly RemoteConnection[],
) {
  const next = remotes.map((remote) => {
    const kept = current.find((entry) => sameRemote(entry.remote, remote));
    return kept
      ? { remote, connection: kept.connection }
      : remoteConnection(remote);
  });
  for (const entry of current)
    if (!next.some((kept) => kept.connection === entry.connection))
      close(entry.connection);
  return next;
}

export const useAccessStore = create<AccessState>()((set, get) => ({
  connection: null,
  remoteConnections: remoteConnections(useRemotesStore.getState().remotes, []),
  generation: 0,
  connect(environmentId) {
    const current = get().connection;
    if (current?.environmentId === environmentId) return current;
    if (current) close(current);
    const connection = localConnection(environmentId);
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
    if (current) close(current);
    set((state) => ({
      connection: null,
      generation: state.generation + 1,
    }));
  },
}));

useRemotesStore.subscribe(({ remotes }) =>
  useAccessStore.setState({
    remoteConnections: remoteConnections(
      remotes,
      useAccessStore.getState().remoteConnections,
    ),
  }),
);

export function useRemoteConnections() {
  return useAccessStore((state) => state.remoteConnections);
}

export function useRemoteConnection(environmentId: string) {
  return useAccessStore((state) =>
    state.remoteConnections.find(
      (entry) => entry.remote.environmentId === environmentId,
    ),
  );
}
