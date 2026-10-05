import type { BrowserSession } from '@porcelain/client/access/rules';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import type { AccessPlatform } from '@porcelain/client/access';

export const pairingPlatform: AccessPlatform = {
  name: () =>
    typeof navigator === 'undefined'
      ? 'Browser'
      : navigator.userAgent.slice(0, WEB_PLATFORM_NAME_MAX_LENGTH) || 'Browser',
  send: fetch,
};
import { syncRemoteConnections } from '@porcelain/client/access/rules';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { savedJson } from '@/shared/lib/saved-json';
import { desktopCredentials } from '@/shared/adapters/desktop';
import { savedRemotes } from './rules/remotes';
import {
  parseRemotes,
  withRemote,
  type Remote,
} from '@porcelain/client/access/rules';
import { REQUEST_TIMEOUT_MS } from '@/config/limits';
import { browserTransport } from '@/shared/api/transport';
import {
  createWorktreeConnection,
  remoteTransport,
  type Transport,
} from '@porcelain/client/transport';
import { remoteLiveUpdates, type LiveUpdatePort } from '@porcelain/client/live';
import {
  sameOriginLiveUpdates,
  webSocket,
} from '@/shared/adapters/live-socket';
import { adoptFileDrafts } from '@porcelain/client/files';
import { ConnectionError } from '@porcelain/client/transport';
import { createOperationStore } from '@porcelain/client/git-actions';
import {
  type Connection,
  type ConnectionContext,
  requireConnection,
} from '@/shared/workspace/connection';

export type RemoteConnection = { remote: Remote; connection: Connection };

type Server = {
  address: string;
  transport: Transport;
  liveUpdates: LiveUpdatePort;
  operationsKey: string | undefined;
};

type AccessState = {
  connection: Connection | null;
  remoteConnections: readonly RemoteConnection[];
  generation: number;
  writerIdentity: string | undefined;
  connect: (session: BrowserSession) => Connection;
  beginConnection: (
    automatic?: boolean,
  ) => ((session: BrowserSession) => boolean) | null;
  clear: () => void;
};

function createConnection(environmentId: string, server: Server): Connection {
  const { connection: requests, controller } = createWorktreeConnection({
    environmentId,
    transport: server.transport,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const connection: Connection = {
    ...requests,
    address: server.address,
    environmentId,
    controller,
    operations: createOperationStore({
      key: server.operationsKey ?? '',
      storage: {
        getItem(key) {
          if (!server.operationsKey)
            throw new ConnectionError({
              message:
                'Pair this environment again to identify its pending Git operations.',
            });
          return window.sessionStorage.getItem(key);
        },
        setItem: (key, value) => window.sessionStorage.setItem(key, value),
        removeItem: (key) => window.sessionStorage.removeItem(key),
      },
    }),
    liveUpdates: server.liveUpdates,
  };
  adoptFileDrafts(connection);
  return connection;
}

function localConnection({ inventory, principal }: BrowserSession) {
  const writer = principal.kind === 'owner' ? 'owner' : principal.deviceId;
  return createConnection(inventory.environmentId, {
    address: window.location.href,
    transport: browserTransport(fetch),
    liveUpdates: sameOriginLiveUpdates(),
    operationsKey: `porcelain-git-requests:${JSON.stringify([inventory.environmentId, principal.kind, writer])}`,
  });
}

function remoteConnection(remote: Remote) {
  const transport = remoteTransport(remote.address, remote.credential, fetch);
  return createConnection(remote.environmentId, {
    address: remote.address,
    transport,
    liveUpdates: remoteLiveUpdates(remote.address, transport, webSocket),
    operationsKey: remote.deviceId
      ? `porcelain-git-requests:${JSON.stringify([remote.environmentId, remote.address, remote.deviceId])}`
      : undefined,
  });
}

function close(connection: Connection) {
  connection.operations.close();
  connection.controller.abort();
}

type RemotesState = {
  remotes: Remote[];
  unreadable: string | undefined;
  save: (remote: Remote) => void;
  forget: (environmentId: string) => void;
};

function remotesStorage() {
  const credentials = desktopCredentials();
  if (!credentials) return savedJson(() => localStorage, parseRemotes);
  let readable = false;
  return {
    async getItem() {
      const saved = savedRemotes(await credentials.read());
      if (saved.kind === 'unreadable') throw new Error(saved.message);
      readable = true;
      return saved.remotes === undefined ? null : { state: saved.remotes };
    },
    async setItem(_name: string, value: { state: Remote[] }) {
      if (readable) await credentials.write(JSON.stringify(value.state));
    },
    async removeItem() {
      await credentials.clear();
    },
  };
}

export const useRemotesStore = create<RemotesState>()(
  persist<RemotesState, [], [], Remote[]>(
    (set, get) => ({
      remotes: [],
      unreadable: undefined,
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
      storage: remotesStorage(),
      partialize: ({ remotes }) => remotes,
      merge: (saved, current) => ({ ...current, remotes: parseRemotes(saved) }),
      onRehydrateStorage: () => (_state, error) => {
        if (error instanceof Error)
          useRemotesStore.setState({ unreadable: error.message });
      },
    },
  ),
);

function remoteConnections(
  remotes: readonly Remote[],
  current: readonly RemoteConnection[],
) {
  const { next, closed } = syncRemoteConnections(
    remotes,
    current,
    remoteConnection,
  );
  for (const connection of closed) close(connection);
  return next;
}

export const useAccessStore = create<AccessState>()((set, get) => ({
  connection: null,
  remoteConnections: remoteConnections(useRemotesStore.getState().remotes, []),
  generation: 0,
  writerIdentity: undefined,
  connect(session) {
    const environmentId = session.inventory.environmentId;
    const writerIdentity = JSON.stringify(session.principal);
    const current = get().connection;
    if (
      current?.environmentId === environmentId &&
      get().writerIdentity === writerIdentity
    )
      return current;
    if (current) close(current);
    const connection = localConnection(session);
    set({ connection, writerIdentity });
    return connection;
  },
  beginConnection(automatic = false) {
    if (automatic && get().generation !== 0) return null;
    const attempt = get().generation;
    return (session) => {
      if (attempt !== get().generation) return false;
      set({ generation: attempt + 1 });
      get().connect(session);
      return true;
    };
  },
  clear() {
    const current = get().connection;
    if (current) close(current);
    set((state) => ({
      connection: null,
      writerIdentity: undefined,
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

export function useConnectedContext(remote?: Connection): ConnectionContext {
  const local = useAccessStore((state) => state.connection);
  if (remote) return { connection: remote };
  return { connection: requireConnection(local) };
}
