import { Effect, Exit, FileSystem, Path, Scope, type Clock } from 'effect';
import { networkInterfaces } from 'node:os';
import type { HostPolicy, PairingReach } from '@porcelain/access/models';
import type { OwnerStatus } from '@porcelain/kernel/models';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import type { Job } from '../ports/job.ts';
import type { OpenedServer } from '../ports/opened-server.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import type { Runtime } from '../ports/runtime.ts';
import type { ClosableListener } from '../ports/closable-listener.ts';
import { prepareDataDirectory } from './data-directory.ts';
import { acquireDirectoryLock } from './directory-lock.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { OwnerSocketUnreadableError } from './errors/owner-socket-unreadable-error.ts';
import { restrictOwnerSocket } from './owner-socket.ts';
import { releaseInOrder } from './release-in-order.ts';

export type OpenServer = (input: {
  settings: ServerSettings;
  pairingReach: () => PairingReach;
  runtimeStatus: () => OwnerStatus;
}) => Effect.Effect<OpenedServer, never, Scope.Scope>;
type ApplicationStarter = {
  openServer: OpenServer;
  ownerProbe: OwnerProbe;
  clock: Clock.Clock;
};
type RuntimeParts = {
  opened?: OpenedServer | undefined;
  jobs: Job[];
  listeners: ClosableListener[];
};

const shutDown = Effect.fn('Application.shutDown')(function* (
  parts: RuntimeParts,
) {
  const opened = parts.opened;
  const stopJobs = releaseInOrder(parts.jobs.map((job) => job.stop()));
  yield* releaseInOrder(
    opened
      ? [
          ...parts.listeners.map((listener) => listener.close()),
          stopJobs,
          opened.close(),
        ]
      : [stopJobs],
  );
});

function listeningOn(host: string): string[] {
  if (host !== '0.0.0.0' && host !== '::') return [host];
  const families = host === '0.0.0.0' ? ['IPv4'] : ['IPv4', 'IPv6'];
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => families.includes(entry.family))
    .map((entry) => entry.address);
}

export const startApplication = Effect.fn('startApplication')(function* (
  settings: ServerSettings,
  starter: ApplicationStarter,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const applicationScope = yield* Scope.fork(yield* Scope.Scope, 'sequential');
  const { host, port, allowedHosts, limits } = settings;
  const parts: RuntimeParts = { jobs: [], listeners: [] };
  const startup = Effect.scoped(
    Effect.gen(function* () {
      const directory = yield* prepareDataDirectory(settings.dataDirectory);
      const socketPath = ownerSocketPath(directory);
      const reach: { port: number; policy: HostPolicy } = {
        port: 0,
        policy: { allowedHosts, localAddresses: [] },
      };
      let status: OwnerStatus = {
        address: '',
        dataDirectory: directory,
        pid: process.pid,
      };
      yield* acquireDirectoryLock({
        path: pathApi.join(directory, 'server.lock'),
        waitMs: limits.locks.startupWaitMs,
        pollMs: limits.locks.pollMs,
        staleTakeovers: limits.locks.staleTakeovers,
        clock: starter.clock,
        held: () => new DataDirectoryOwnedError(directory),
      }).pipe(Scope.provide(applicationScope));
      const probe = yield* starter.ownerProbe.probe({
        socketPath,
        timeoutMs: limits.owner.probeTimeoutMs,
      });
      if (probe.kind === 'running')
        return yield* Effect.fail(new DataDirectoryOwnedError(directory));
      if (probe.kind === 'unreadable')
        return yield* Effect.fail(
          new OwnerSocketUnreadableError(socketPath, probe.reason),
        );
      yield* fs.remove(socketPath, { force: true });
      parts.opened = yield* starter
        .openServer({
          settings: { ...settings, dataDirectory: directory },
          pairingReach: () => reach,
          runtimeStatus: () => status,
        })
        .pipe(Scope.provide(applicationScope));
      yield* Scope.addFinalizer(applicationScope, shutDown(parts));
      const opened = parts.opened;
      for (const job of opened.jobs) {
        parts.jobs.push(job);
        yield* job.start();
      }
      const network = yield* opened.network
        .start({ host, port })
        .pipe(Scope.provide(applicationScope));
      parts.listeners.push(network);
      const address = network.address;
      status = { ...status, address };
      reach.port = Number(new URL(address).port);
      reach.policy = { allowedHosts, localAddresses: listeningOn(host) };
      const owner = yield* opened.owner
        .start({ path: socketPath })
        .pipe(Scope.provide(applicationScope));
      parts.listeners.push(owner);
      yield* restrictOwnerSocket(socketPath);
      const close = yield* Effect.cached(
        Scope.close(applicationScope, Exit.void),
      );
      return {
        address,
        socketPath,
        close: () => close,
      } satisfies Runtime;
    }),
  );
  return yield* startup.pipe(
    Effect.onExit((exit) =>
      Exit.isFailure(exit) ? Scope.close(applicationScope, exit) : Effect.void,
    ),
    Effect.orDie,
  );
});
