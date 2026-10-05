import type { BrowserSession } from '@porcelain/client/access/rules';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import {
  AccessStore,
  EnvironmentStorage,
  type AccessPlatform,
} from '@porcelain/client/access';
import { Effect } from 'effect';
import { Atom, AtomRef } from 'effect/reactivity';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import { environmentStorage } from './adapters/environment-storage';

export const pairingPlatform: AccessPlatform = {
  name: () =>
    typeof navigator === 'undefined'
      ? 'Browser'
      : navigator.userAgent.slice(0, WEB_PLATFORM_NAME_MAX_LENGTH) || 'Browser',
  send: fetch,
};
import { syncRemoteConnections } from '@porcelain/client/access/rules';
import { type Remote } from '@porcelain/client/access/rules';
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
  readonly connection: Connection | null;
  readonly remoteConnections: readonly RemoteConnection[];
  readonly generation: number;
  readonly writerIdentity: string | undefined;
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

export const accessStore = Effect.runSync(
  AccessStore.pipe(
    Effect.provide(AccessStore.layer),
    Effect.provideService(EnvironmentStorage, environmentStorage),
  ),
);
const restoreSavedEnvironments = Atom.make((get) => {
  const synchronize = ({ remotes }: { remotes: readonly Remote[] }) =>
    state.update((current) => ({
      ...current,
      remoteConnections: remoteConnections(remotes, current.remoteConnections),
    }));
  synchronize(accessStore.state.value);
  get.addFinalizer(accessStore.state.subscribe(synchronize));
  return accessStore.load();
});

export function useRestoreEnvironments() {
  useAtomValue(restoreSavedEnvironments);
}

export function useSavedEnvironments() {
  return useAtomRef(accessStore.state);
}

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

const state = AtomRef.make<AccessState>({
  connection: null,
  remoteConnections: [],
  generation: 0,
  writerIdentity: undefined,
});

function connect(session: BrowserSession) {
  const environmentId = session.inventory.environmentId;
  const writerIdentity = JSON.stringify(session.principal);
  const current = state.value.connection;
  if (
    current?.environmentId === environmentId &&
    state.value.writerIdentity === writerIdentity
  )
    return current;
  if (current) close(current);
  const connection = localConnection(session);
  state.update((current) => ({ ...current, connection, writerIdentity }));
  return connection;
}

const snapshot: AtomRef.ReadonlyRef<AccessState> = state;

export const accessSession = {
  state: snapshot,
  beginConnection(automatic = false) {
    if (automatic && state.value.generation !== 0) return null;
    const attempt = state.value.generation;
    return (session: BrowserSession) => {
      if (attempt !== state.value.generation) return false;
      state.update((current) => ({ ...current, generation: attempt + 1 }));
      connect(session);
      return true;
    };
  },
  clear() {
    const current = state.value.connection;
    if (current) close(current);
    state.update((current) => ({
      ...current,
      connection: null,
      writerIdentity: undefined,
      generation: current.generation + 1,
    }));
  },
};

export function useLocalConnection() {
  return useAtomRef(state).connection;
}

export function useRemoteConnections() {
  return useAtomRef(state).remoteConnections;
}

export function useRemoteConnection(environmentId: string) {
  return useAtomRef(state).remoteConnections.find(
    (entry) => entry.remote.environmentId === environmentId,
  );
}

export function useConnectedContext(remote?: Connection): ConnectionContext {
  const local = useLocalConnection();
  if (remote) return { connection: remote };
  return { connection: requireConnection(local) };
}
