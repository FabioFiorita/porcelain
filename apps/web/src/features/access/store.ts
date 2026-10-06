import { WorkspaceSelectionCleanup } from '@porcelain/client/projects';
import { InventorySeed } from '@porcelain/client/projects';
import type { BrowserSession } from '@porcelain/client/access/rules';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import {
  AccessStore,
  AccessSession,
  remoteConnectionsLayer,
  ConnectionFactory,
  RemoteConnectionFactory,
  RemoteConnections,
  AccessPlatform,
  EnvironmentCommands,
  EnvironmentMutations,
  EnvironmentStorage,
  type AccessPlatformValue,
} from '@porcelain/client/access';
import { Effect, Layer, ManagedRuntime, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import { environmentStorage } from './adapters/environment-storage';

export const pairingPlatform: AccessPlatformValue = {
  name: () =>
    typeof navigator === 'undefined'
      ? 'Browser'
      : navigator.userAgent.slice(0, WEB_PLATFORM_NAME_MAX_LENGTH) || 'Browser',
  send: fetch,
};
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

type Server = {
  address: string;
  transport: Transport;
  liveUpdates: LiveUpdatePort;
  operationsKey: string | undefined;
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

function localConnection({ inventory, principal }: BrowserSession): Connection {
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

function remoteConnection(remote: Remote): Connection {
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

const stores = Layer.merge(AccessStore.layer, EnvironmentMutations.layer).pipe(
  Layer.provide(Layer.succeed(EnvironmentStorage, environmentStorage)),
);
const services = Layer.mergeAll(
  stores,
  Layer.succeed(AccessPlatform, pairingPlatform),
  FileDrafts.layer,
  Layer.succeed(ConnectionFactory, {
    local: (session) =>
      Effect.acquireRelease(
        Effect.sync(() => localConnection(session)),
        (connection) => Effect.promise(() => connection.close()),
      ),
  }),
  Layer.succeed(RemoteConnectionFactory, {
    open: (remote) =>
      Effect.acquireRelease(
        Effect.sync(() => remoteConnection(remote)),
        (connection) => Effect.promise(() => connection.close()),
      ),
  }),
  Layer.succeed(WorkspaceSelectionCleanup, {
    forgetEnvironment: () => Effect.void,
  }),
);
const application = remoteConnectionsLayer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      EnvironmentCommands.layer,
      AccessSession.layer,
      RemoteConnections.layer,
    ).pipe(Layer.provideMerge(services)),
  ),
);
export const applicationRuntime = ManagedRuntime.make(application);
export const environmentRuntime = Atom.context({
  memoMap: applicationRuntime.memoMap,
})(application);
const accessStore = applicationRuntime.runSync(AccessStore);
export const accessSession = applicationRuntime.runSync(AccessSession);
const remoteConnections = applicationRuntime.runSync(RemoteConnections);
const restoreSavedEnvironments = environmentRuntime.atom(
  Effect.gen(function* () {
    const commands = yield* EnvironmentCommands;
    yield* commands.read();
  }),
);

export function useRestoreEnvironments() {
  useAtomValue(restoreSavedEnvironments);
}

export function useSavedEnvironments() {
  return useAtomRef(accessStore.state);
}

export function useLocalConnection() {
  return useAtomRef(accessSession.state).connection;
}

export function useRemoteConnections() {
  return useAtomRef(remoteConnections.state);
}

export function useRemoteConnection(environmentId: string) {
  return useAtomRef(remoteConnections.state).find(
    (entry) => entry.remote.environmentId === environmentId,
  );
}

export function useConnectedContext(remote?: Connection): ConnectionContext {
  const local = useLocalConnection();
  if (remote) return { connection: remote };
  return { connection: requireConnection(local) };
}
