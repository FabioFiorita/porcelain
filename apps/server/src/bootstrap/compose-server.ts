import { Context, Effect, Layer } from 'effect';
import type { StorageSession } from '@porcelain/storage';
import { nativeOperation } from '@porcelain/effects';
import { releaseInOrder } from '../runtime/release-in-order.ts';
import {
  ServerComponents,
  ServerResources,
} from '../runtime/server-resources.ts';
import type { Server } from 'node:http';
import type {
  NetworkAddressReader,
  RouteListenerRunner,
  TunnelProbe,
} from '@porcelain/access/ports';
import { createCommitPlanner } from '@porcelain/agents/commit-planning';
import { readGitVersion } from '@porcelain/git/discovery';
import { ConfirmWorktreeService } from '@porcelain/projects/services';
import { gitDirectoryName, isTemporaryWrite } from '@porcelain/kernel/rules';
import { deriveWorktreeId } from '@porcelain/projects/rules';
import { openStorageSession } from '@porcelain/storage';
import { SocketOwnerProbe } from '../adapters/access/socket-owner-probe.ts';
import { InMemoryDeviceConnectionStore } from '../adapters/access/in-memory-device-connection-store.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
import { HttpRouteListenerRunner } from '../adapters/access/http-route-listener-runner.ts';
import { HttpTunnelProbe } from '../adapters/access/http-tunnel-probe.ts';
import { InMemoryTunnelConnectionStore } from '../adapters/access/in-memory-tunnel-connection-store.ts';
import { MacNetworkAddressReader } from '../adapters/access/mac-network-address-reader.ts';
import { readNetworkPlatform } from '../config/network-platform.ts';
import { OsNetworkAddressReader } from '../adapters/access/os-network-address-reader.ts';
import { ProcessRuntimeStatusReader } from '../adapters/access/process-runtime-status-reader.ts';
import { ParcelWorktreeWatcher } from '../adapters/events/parcel-worktree-watcher.ts';
import { WebSocketEventPublisher } from '../adapters/events/web-socket-event-publisher.ts';
import { ProcessCommitDraftSource } from '../adapters/git-actions/process-commit-draft-source.ts';
import { ProcessCommitModelReader } from '../adapters/git-actions/process-commit-model-reader.ts';
import { FilesystemProjectFolderReader } from '../adapters/projects/filesystem-project-folder-reader.ts';
import { InMemoryWorktreeCatalogStore } from '../adapters/projects/in-memory-worktree-catalog-store.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { StderrLogger } from '../adapters/runtime/stderr-logger.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { FilesystemWebRootReader } from '../adapters/web/filesystem-web-root-reader.ts';
import { operationDeadlineMs } from '../config/operation-deadline.ts';
import type { Limits } from '../config/limits.ts';
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { IntervalJob, JobSequence } from '../runtime/interval-job.ts';
import type { Job } from '../ports/job.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import {
  LiveConnections,
  LiveHeartbeat,
  LivePing,
} from '../runtime/live-updates/live-connections.ts';
import { WatchWorktrees } from '../runtime/live-updates/watch-worktrees.ts';
import { AnnounceWorktreeChangeUseCase } from '../use-cases/files/announce-worktree-change.ts';
import type { StartServer } from '../cli/launcher.ts';
import type { ServerHost } from '../ports/server-host.ts';
import {
  startApplication,
  type OpenServer,
} from '../runtime/start-application.ts';
import { composeAccess } from './compose-access.ts';
import { composeChanges } from './compose-changes.ts';
import type { ComposeContext } from './compose-context.ts';
import { composeFiles } from './compose-files.ts';
import { composeGitActions } from './compose-git-actions.ts';
import { composeProjects } from './compose-projects.ts';
import { composeReviews } from './compose-reviews.ts';
import { composeShared } from './compose-shared.ts';
import { composeStores } from './compose-stores.ts';

type RemoteRouteAdapters = {
  networkAddressReader: (
    limits: Limits['access']['networkDiscovery'],
  ) => NetworkAddressReader;
  routeListenerRunner: (target: () => Server) => RouteListenerRunner;
  tunnelProbe: (options: { timeoutMs: number }) => TunnelProbe;
};

class ServerFoundation extends Context.Service<
  ServerFoundation,
  {
    readonly session: StorageSession;
    readonly gitVersion: Awaited<ReturnType<typeof readGitVersion>>;
  }
>()('@porcelain/server/ServerFoundation') {}

function serverResources(
  adapters: RemoteRouteAdapters,
  host: ServerHost,
  input: Parameters<OpenServer>[0],
) {
  const foundation = Layer.effect(
    ServerFoundation,
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() => host.serviceUpdateRunner.close());
      const { settings } = input;
      const { limits } = settings;
      const gitVersion = yield* nativeOperation((signal) =>
        readGitVersion(limits.git, signal),
      );
      const session = yield* Effect.acquireRelease(
        Effect.sync(() =>
          openStorageSession(settings.dataDirectory, {
            worktreeIdLength: limits.projects.worktreeIds.length,
            busyTimeoutMs: limits.storage.busyTimeoutMs,
          }),
        ),
        (opened) => Effect.sync(() => opened.close()),
      );
      return { session, gitVersion };
    }),
  );
  const components = Layer.effect(
    ServerComponents,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const { settings } = input;
        const { limits } = settings;
        const { session, gitVersion } = yield* ServerFoundation;
        const worktreeId = (projectId: string, metadataIdentity: string) =>
          deriveWorktreeId(
            projectId,
            metadataIdentity,
            limits.projects.worktreeIds.length,
          );
        const stores = composeStores(session);
        const catalog = new InMemoryWorktreeCatalogStore();
        const clock = new SystemClock();
        const lanes = new Lanes({
          deadlineMs: () =>
            operationDeadlineMs(catalog.listObservations().length, limits),
          readCapacity: limits.lanes.readCapacity,
          consistency: new ConfirmWorktreeService(catalog),
        });
        const logger = new StderrLogger(clock);
        const liveConnections = new LiveConnections();
        const events = new WebSocketEventPublisher(liveConnections);
        const shared = yield* composeShared({
          settings,
          stores,
          catalog,
          gitVersion,
          worktreeId,
          clock,
          logger,
        });
        const context: ComposeContext = {
          lanes,
          laneKeys: new LaneKeys(),
          events,
          settings,
          clock,
          ids: new RandomIdSource(),
          logger,
        };
        const deviceConnections = new InMemoryDeviceConnectionStore();
        const tunnelConnections = new InMemoryTunnelConnectionStore();
        const routeListenerRunner = adapters.routeListenerRunner(
          () => network.server,
        );
        const access = yield* composeAccess(context, {
          desktopSession: host.desktopSession,
          stores,
          shared,
          deviceConnections,
          tunnelConnections,
          pairingReachReader: new HttpPairingReachReader(
            input.pairingReach,
            stores.routeStates,
          ),
          runtimeStatusReader: new ProcessRuntimeStatusReader(
            input.runtimeStatus,
          ),
          serviceUpdateRunner: host.serviceUpdateRunner,
          serverVersion: host.version,
          networkAddressReader: adapters.networkAddressReader(
            limits.access.networkDiscovery,
          ),
          routeListenerRunner,
          tunnelProbe: adapters.tunnelProbe({
            timeoutMs: limits.access.remoteAccess.probeTimeoutMs,
          }),
        });
        const projects = composeProjects(context, {
          stores,
          shared,
          projectFolderReader: new FilesystemProjectFolderReader({
            gitDirectory: gitDirectoryName(),
          }),
        });
        const { checkWorktree } = projects;
        const changes = composeChanges(context, { shared, checkWorktree });
        const reviews = composeReviews(context, {
          stores,
          shared,
          checkWorktree,
          findWorktreeByPath: projects.findWorktreeByPath,
        });
        const worktreeWatches = new WatchWorktrees(
          new AnnounceWorktreeChangeUseCase(
            reviews.invalidateReviewedMarks,
            events,
            logger,
          ),
          projects.refreshInventory,
          new ParcelWorktreeWatcher({
            worktrees: shared.worktreeAccess,
            projects: () => catalog.listObservations(),
            gitDirectory: gitDirectoryName(),
            isTemporaryWrite,
            limits: limits.git,
          }),
          logger,
          limits.liveUpdates,
        );
        const files = composeFiles(context, {
          shared,
          checkWorktree,
          invalidateReviewedMarks: reviews.invalidateReviewedMarks,
          editAnnouncements: worktreeWatches,
        });
        const commitPlanner = createCommitPlanner(limits.agents);
        const gitActions = composeGitActions(context, {
          stores,
          shared,
          checkWorktree,
          refreshWorktreeReview: reviews.refreshWorktreeReview,
          commitDraftSource: new ProcessCommitDraftSource(commitPlanner),
          commitModelReader: new ProcessCommitModelReader(commitPlanner),
        });
        const jobs: readonly Job[] = [
          new IntervalJob(
            'recover-interrupted-git-actions',
            gitActions.recoverInterruptedGitActions,
            { atStart: true },
            logger,
          ),
          new IntervalJob(
            'refresh-inventory',
            new JobSequence([
              projects.refreshInventory,
              reviews.refreshReviewActivity,
            ]),
            { atStart: true, everyMs: limits.jobs.refreshInventoryMs },
            logger,
          ),
          new IntervalJob(
            'collect-absent-worktrees',
            projects.collectAbsentWorktrees,
            { everyMs: limits.jobs.collectAbsentWorktreesMs },
            logger,
          ),
          new IntervalJob(
            'flush-device-activity',
            access.flushDeviceActivity,
            { everyMs: limits.jobs.flushDeviceActivityMs, atStop: true },
            logger,
          ),
          new IntervalJob(
            'open-remote-routes',
            access.openRemoteRoutes,
            { atStart: true, everyMs: limits.jobs.openRemoteRoutesMs },
            logger,
          ),
          new IntervalJob(
            'close-remote-routes',
            access.closeRemoteRoutes,
            { atStop: true },
            logger,
          ),
          new IntervalJob(
            'heartbeat',
            new LiveHeartbeat(liveConnections),
            { everyMs: limits.liveUpdates.heartbeatMs },
            logger,
          ),
          new IntervalJob(
            'ping-live-clients',
            new LivePing(liveConnections),
            { everyMs: limits.liveUpdates.pingMs },
            logger,
          ),
        ];
        const useCases = {
          access,
          projects: projects.routes,
          files,
          changes: changes.routes,
          reviews: reviews.routes,
          gitActions: gitActions.routes,
        };
        const network = createNetworkServer({
          application: {
            ...useCases,
            reviewPages: reviews.summaryRoutes,
            liveUpdates: liveConnections,
            worktreeWatches,
            deviceConnections,
            tunnelConnections,
            logger,
          },
          settings,
          files: new FilesystemWebRootReader(settings.webRoot),
          logger,
        });
        return {
          jobs,
          network,
          owner: createOwnerServer({
            application: { ...useCases, reviewTools: reviews },
            logger,
            limits,
          }),
          close: () =>
            Effect.runPromise(
              releaseInOrder([
                routeListenerRunner.close({ route: 'lan' }),
                routeListenerRunner.close({ route: 'tailnet' }),
                nativeOperation(() => worktreeWatches.close()),
                nativeOperation(() => projects.refreshInventory.close()),
                nativeOperation(() => shared.inventoryReads.close()),
                nativeOperation(() => changes.statusReads.close()),
                Effect.sync(() => liveConnections.close()),
                nativeOperation(() => lanes.close()),
                nativeOperation(() => files.dispose()),
                nativeOperation(() => gitActions.routes.dispose()),
                nativeOperation(() => projects.routes.dispose()),
                nativeOperation(() => changes.routes.dispose()),
                nativeOperation(() => reviews.routes.dispose()),
                nativeOperation(() => reviews.summaryRoutes.dispose()),
                ...Object.values(access.routes).map((routes) =>
                  nativeOperation(() => routes.dispose()),
                ),
              ]),
            ),
        };
      }),
      (opened) => nativeOperation(() => opened.close()),
    ),
  );
  return components.pipe(Layer.provide(foundation));
}

const openServerWith =
  (adapters: RemoteRouteAdapters, host: ServerHost): OpenServer =>
  (input) =>
    new ServerResources(serverResources(adapters, host, input)).open(
      input.signal,
    );

export const composeServer =
  (adapters: RemoteRouteAdapters): StartServer =>
  (settings, signal, host) =>
    startApplication(settings, signal, {
      openServer: openServerWith(adapters, host),
      ownerProbe: new SocketOwnerProbe(),
      clock: new SystemClock(),
    });

const networkReaders = {
  darwin: (limits: Limits['access']['networkDiscovery']) =>
    new MacNetworkAddressReader(limits),
  linux: (_limits: Limits['access']['networkDiscovery']) =>
    new OsNetworkAddressReader(),
};

export const startServer: StartServer = composeServer({
  networkAddressReader: networkReaders[readNetworkPlatform()],
  routeListenerRunner: (target) => new HttpRouteListenerRunner(target),
  tunnelProbe: (options) => new HttpTunnelProbe(options),
});
