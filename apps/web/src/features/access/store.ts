import { WorkspaceSelectionCleanup } from '@porcelain/client/projects';
import { InventorySeed } from '@porcelain/client/projects';
import type { BrowserSession } from '@porcelain/client/access/rules';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import {
  AccessStore,
  AccessPlatform,
  EnvironmentCommands,
  EnvironmentMutations,
  EnvironmentStorage,
  type AccessPlatformValue,
} from '@porcelain/client/access';
import { Effect, Layer, ManagedRuntime, Option } from 'effect';
import { Atom, AtomRef } from 'effect/reactivity';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import { environmentStorage } from './adapters/environment-storage';

export const pairingPlatform: AccessPlatformValue = {
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
import type { Transport } from '@porcelain/client/transport';
import {
  openLiveConnection,
  openRemoteConnection,
  type LiveUpdatePort,
} from '@porcelain/client/live';
import {
  sameOriginLiveUpdates,
  webSocket,
} from '@/shared/adapters/live-socket';
import { FileDrafts } from '@porcelain/client/files';
import { OperationStorage } from '@porcelain/client/git-actions';
import { operationStorage } from './adapters/operation-storage';
import { BrowserCrypto } from '@effect/platform-browser';
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
  return openLiveConnection(
    {
      environmentId,
      address: server.address,
      transport: server.transport,
      liveUpdates: server.liveUpdates,
      timeoutMs: REQUEST_TIMEOUT_MS,
    },
    Layer.merge(
      BrowserCrypto.layer,
      Layer.succeed(OperationStorage, operationStorage(server.operationsKey)),
    ),
    applicationRuntime.memoMap,
  );
}

function localConnection({ inventory, principal }: BrowserSession) {
  const writer = principal.kind === 'owner' ? 'owner' : principal.deviceId;
  const connection = createConnection(inventory.environmentId, {
    address: window.location.href,
    transport: browserTransport(fetch),
    liveUpdates: sameOriginLiveUpdates(),
    operationsKey: `porcelain-git-requests:${JSON.stringify([inventory.environmentId, principal.kind, writer])}`,
  });
  connection.atoms.addGlobalLayer(
    Layer.succeed(InventorySeed, Option.some(inventory)),
  );
  return connection;
}

function remoteConnection(remote: Remote) {
  return openRemoteConnection(
    {
      ...remote,
      send: fetch,
      socket: webSocket,
      timeoutMs: REQUEST_TIMEOUT_MS,
    },
    Layer.merge(
      BrowserCrypto.layer,
      Layer.succeed(
        OperationStorage,
        operationStorage(
          remote.deviceId
            ? `porcelain-git-requests:${JSON.stringify([remote.environmentId, remote.address, remote.deviceId])}`
            : undefined,
        ),
      ),
    ),
    applicationRuntime.memoMap,
  );
}

function close(connection: Connection) {
  void connection.close();
}

const stores = Layer.merge(AccessStore.layer, EnvironmentMutations.layer).pipe(
  Layer.provide(Layer.succeed(EnvironmentStorage, environmentStorage)),
);
const services = Layer.mergeAll(
  stores,
  Layer.succeed(AccessPlatform, pairingPlatform),
  FileDrafts.layer,
  Layer.succeed(WorkspaceSelectionCleanup, {
    forgetEnvironment: () => Effect.void,
  }),
);
const application = Layer.provideMerge(EnvironmentCommands.layer, services);
const applicationRuntime = ManagedRuntime.make(application);
export const environmentRuntime = Atom.context({
  memoMap: applicationRuntime.memoMap,
})(application);
const accessStore = applicationRuntime.runSync(AccessStore);
const restoreSavedEnvironments = environmentRuntime.atom((get) => {
  const synchronize = ({ remotes }: { remotes: readonly Remote[] }) =>
    state.update((current) => ({
      ...current,
      remoteConnections: remoteConnections(remotes, current.remoteConnections),
    }));
  synchronize(accessStore.state.value);
  get.addFinalizer(accessStore.state.subscribe(synchronize));
  return Effect.gen(function* () {
    const commands = yield* EnvironmentCommands;
    yield* commands.read();
  });
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
