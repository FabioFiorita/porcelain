import {
  CommitDraftSource,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
import { Logger } from '../ports/logger.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { AnnounceWorktreeChangeUseCasePort } from '../ports/announce-worktree-change-use-case-port.ts';
import { InventoryRefresh } from '../ports/inventory-refresh.ts';
import { InvalidateReviewedMarksUseCasePort } from '../ports/invalidate-reviewed-marks-use-case-port.ts';
import { LaneOptions } from '../ports/lane-options.ts';
import {
  ProjectFolderReader,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import { Context, Duration, Effect, Layer, Clock } from 'effect';
import { storageLayer } from '@porcelain/storage';
import { NodeServices, NodeHttpClient } from '@effect/platform-node';
import { cachedDeviceStoreLayer } from '../adapters/access/cached-device-store.ts';
import { cachedRemoteAccessStoreLayer } from '../adapters/access/cached-remote-access-store.ts';
import { releaseInOrder } from '../runtime/release-in-order.ts';
import {
  ServerComponents,
  openServerResources,
} from '../runtime/server-resources.ts';
import { type Server } from 'node:http';
import {
  NetworkAddressReader,
  RouteListenerRunner,
  TunnelProbe,
} from '@porcelain/access/ports';
import {
  CommitPlanner,
  CodexProvider,
  ClaudeProvider,
} from '@porcelain/agents/commit-planning';
import { readGitVersion } from '@porcelain/git/discovery';
import { ConfirmWorktreeService } from '@porcelain/projects/services';
import { gitDirectoryName, isTemporaryWrite } from '@porcelain/kernel/rules';
import { deriveWorktreeId } from '@porcelain/projects/rules';
import { SocketOwnerProbe } from '../adapters/access/socket-owner-probe.ts';
import { InMemoryDeviceConnectionStore } from '../adapters/access/in-memory-device-connection-store.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
import { httpRouteListenerRunnerLayer } from '../adapters/access/http-route-listener-runner.ts';
import { httpTunnelProbeLayer } from '../adapters/access/http-tunnel-probe.ts';
import { InMemoryTunnelConnectionStore } from '../adapters/access/in-memory-tunnel-connection-store.ts';
import { macNetworkAddressReaderLayer } from '../adapters/access/mac-network-address-reader.ts';
import { readNetworkPlatform } from '../config/network-platform.ts';
import { osNetworkAddressReaderLayer } from '../adapters/access/os-network-address-reader.ts';
import { ProcessRuntimeStatusReader } from '../adapters/access/process-runtime-status-reader.ts';
import { parcelWorktreeWatcherLayer } from '../adapters/events/parcel-worktree-watcher.ts';
import { webSocketEventPublisherLayer } from '../adapters/events/web-socket-event-publisher.ts';
import { processCommitDraftSourceLayer } from '../adapters/git-actions/process-commit-draft-source.ts';
import { processCommitModelReaderLayer } from '../adapters/git-actions/process-commit-model-reader.ts';
import { filesystemProjectFolderReaderLayer } from '../adapters/projects/filesystem-project-folder-reader.ts';
import { InMemoryWorktreeCatalogStore } from '../adapters/projects/in-memory-worktree-catalog-store.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { StderrLogger } from '../adapters/runtime/stderr-logger.ts';
import { filesystemWebRootReaderLayer } from '../adapters/web/filesystem-web-root-reader.ts';
import { operationDeadline } from '../config/operation-deadline.ts';
import { type Limits } from '../config/limits.ts';
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { makeIntervalJob, jobSequence } from '../runtime/interval-job.ts';
import { type Job } from '../ports/job.ts';
import { WebRootReader } from '../ports/web-root-reader.ts';
import { Observability } from '../runtime/observability.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LiveConnections } from '../runtime/live-updates/live-connections.ts';
import { WatchWorktrees } from '../runtime/live-updates/watch-worktrees.ts';
import { AnnounceWorktreeChangeUseCase } from '../use-cases/files/announce-worktree-change.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import { type ServerHost } from '../ports/server-host.ts';
import {
  startApplication,
  type OpenServer,
} from '../runtime/start-application.ts';
import { composeAccess } from './compose-access.ts';
import { composeChanges } from './compose-changes.ts';
import { type ComposeContext } from './compose-context.ts';
import { composeFiles } from './compose-files.ts';
import { composeGitActions } from './compose-git-actions.ts';
import { composeProjects } from './compose-projects.ts';
import { composeReviews } from './compose-reviews.ts';
import { composeShared } from './compose-shared.ts';
import { composeStores } from './compose-stores.ts';

type RemoteRouteAdapters = {
  networkAddressReader: (
    limits: Limits['access']['networkDiscovery'],
  ) => Layer.Layer<
    '@porcelain/access/NetworkAddressReader',
    never,
    | Layer.Services<ReturnType<typeof macNetworkAddressReaderLayer>>
    | Layer.Services<typeof osNetworkAddressReaderLayer>
  >;
  routeListenerRunner: (
    target: () => Server,
  ) => Layer.Layer<'@porcelain/access/RouteListenerRunner'>;
  tunnelProbe: (options: {
    timeoutMs: number;
  }) => Layer.Layer<
    '@porcelain/access/TunnelProbe',
    never,
    Layer.Services<ReturnType<typeof httpTunnelProbeLayer>>
  >;
};

class ServerFoundation extends Context.Service<
  ServerFoundation,
  {
    readonly gitVersion: Buffer;
  }
>()('@porcelain/server/ServerFoundation') {}

function serverResources(
  adapters: RemoteRouteAdapters,
  host: ServerHost,
  input: Parameters<OpenServer>[0],
) {
  const metadata = Layer.effect(
    ServerFoundation,
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() => host.serviceUpdateRunner.close());
      const { settings } = input;
      const { limits } = settings;
      const gitVersion = yield* readGitVersion(limits.git).pipe(Effect.orDie);
      return { gitVersion };
    }),
  ).pipe(Layer.provide(NodeServices.layer));
  const persistence = Layer.mergeAll(
    cachedDeviceStoreLayer,
    cachedRemoteAccessStoreLayer,
  ).pipe(
    Layer.provideMerge(
      storageLayer(input.settings.dataDirectory, {
        worktreeIdLength: input.settings.limits.projects.worktreeIds.length,
        busyTimeoutMs: input.settings.limits.storage.busyTimeoutMs,
      }).pipe(Layer.provide(NodeServices.layer)),
    ),
  );
  const logging = StderrLogger.layer.pipe(
    Layer.provideMerge(Observability.layer),
  );
  const foundation = Layer.mergeAll(
    metadata,
    persistence,
    NodeServices.layer,
    NodeHttpClient.layerFetch,
    logging,
  );
  const components = Layer.effect(
    ServerComponents,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const { settings } = input;
        const { limits } = settings;
        const { gitVersion } = yield* ServerFoundation;
        const worktreeId = (projectId: string, metadataIdentity: string) =>
          deriveWorktreeId(
            projectId,
            metadataIdentity,
            limits.projects.worktreeIds.length,
          );
        const stores = yield* composeStores();
        const catalog = new InMemoryWorktreeCatalogStore();
        const clock = yield* Clock.Clock;
        const laneContext = yield* Layer.build(Lanes.layer).pipe(
          Effect.provideService(LaneOptions, {
            deadlineMs: () =>
              Duration.toMillis(
                operationDeadline(catalog.listObservations().length, limits),
              ),
            readCapacity: limits.lanes.readCapacity,
            consistency: yield* ConfirmWorktreeService.pipe(
              Effect.provide(ConfirmWorktreeService.layer),
              Effect.provideService(WorktreeCatalogStore, catalog),
            ),
          }),
        );
        const lanes = Context.get(laneContext, Lanes);
        const logger = yield* Logger;
        const observability = yield* Observability;
        const filesystemContext = yield* Layer.build(
          Layer.mergeAll(
            filesystemProjectFolderReaderLayer({
              gitDirectory: gitDirectoryName(),
            }),
            filesystemWebRootReaderLayer(settings.webRoot),
          ),
        );
        const liveContext = yield* Layer.build(
          webSocketEventPublisherLayer.pipe(
            Layer.provideMerge(
              LiveConnections.layer(limits.liveUpdates.eventBuffer).pipe(
                Layer.provide(Layer.succeed(Logger, logger)),
              ),
            ),
          ),
        );
        const liveConnections = Context.get(liveContext, LiveConnections);
        const events = Context.get(liveContext, EventPublisher);
        const shared = yield* composeShared({
          settings,
          stores,
          catalog,
          gitVersion,
          clock,
        });
        const context: ComposeContext = {
          lanes,
          laneKeys: yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
          events,
          settings,
          clock,
          ids: new RandomIdSource(),
          logger,
        };
        const deviceConnections = new InMemoryDeviceConnectionStore();
        const tunnelConnections = new InMemoryTunnelConnectionStore();
        const remoteContext = yield* Layer.build(
          Layer.mergeAll(
            adapters.routeListenerRunner(() => network.server),
            adapters.networkAddressReader(limits.access.networkDiscovery),
            adapters.tunnelProbe({
              timeoutMs: limits.access.remoteAccess.probeTimeoutMs,
            }),
          ),
        );
        const routeListenerRunner = Context.get(
          remoteContext,
          RouteListenerRunner,
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
          networkAddressReader: Context.get(
            remoteContext,
            NetworkAddressReader,
          ),
          routeListenerRunner,
          tunnelProbe: Context.get(remoteContext, TunnelProbe),
        });
        const projects = yield* composeProjects(context, {
          stores,
          shared,
          worktreeId,
          projectFolderReader: Context.get(
            filesystemContext,
            ProjectFolderReader,
          ),
        });
        const { checkWorktree } = projects;
        const changes = yield* composeChanges(context, {
          shared,
          checkWorktree,
        });
        const reviews = yield* composeReviews(context, {
          stores,
          shared,
          checkWorktree,
          findWorktreeByPath: projects.findWorktreeByPath,
        });
        const announcements = yield* AnnounceWorktreeChangeUseCase.pipe(
          Effect.provide(AnnounceWorktreeChangeUseCase.layer),
          Effect.provideService(
            InvalidateReviewedMarksUseCasePort,
            reviews.invalidateReviewedMarks,
          ),
          Effect.provideService(EventPublisher, events),
          Effect.provideService(Logger, logger),
        );
        const watchContext = yield* Layer.build(
          WatchWorktrees.layer(limits.liveUpdates).pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(AnnounceWorktreeChangeUseCasePort, announcements),
                Layer.succeed(InventoryRefresh, projects.refreshInventory),
                Layer.succeed(Logger, logger),
                parcelWorktreeWatcherLayer({
                  worktrees: shared.worktreeAccess,
                  projects: () => catalog.listObservations(),
                  gitDirectory: gitDirectoryName(),
                  isTemporaryWrite,
                  limits: limits.git,
                }).pipe(Layer.provide(NodeServices.layer)),
              ),
            ),
          ),
        );
        const worktreeWatches = Context.get(watchContext, WatchWorktrees);
        const files = yield* composeFiles(context, {
          shared,
          checkWorktree,
          invalidateReviewedMarks: reviews.invalidateReviewedMarks,
          editAnnouncements: worktreeWatches,
        });
        const plannerContext = yield* Layer.build(
          Layer.mergeAll(
            processCommitDraftSourceLayer,
            processCommitModelReaderLayer,
          ).pipe(
            Layer.provide(
              CommitPlanner.layer(limits.agents.plan).pipe(
                Layer.provide(
                  Layer.mergeAll(
                    CodexProvider.layer(limits.agents),
                    ClaudeProvider.layer(limits.agents),
                  ),
                ),
                Layer.provide(NodeServices.layer),
              ),
            ),
          ),
        );
        const gitActions = yield* composeGitActions(context, {
          stores,
          shared,
          checkWorktree,
          refreshWorktreeReview: reviews.refreshWorktreeReview,
          commitDraftSource: Context.get(plannerContext, CommitDraftSource),
          commitModelReader: Context.get(plannerContext, CommitModelReader),
        });
        const jobs: readonly Job[] = [
          yield* makeIntervalJob(
            'recover-interrupted-git-actions',
            { execute: gitActions.gitActionWorkflow.recover },
            { atStart: true },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'refresh-inventory',
            jobSequence([
              projects.refreshInventory,
              reviews.refreshReviewActivity,
            ]),
            { atStart: true, every: limits.jobs.refreshInventory },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'collect-absent-worktrees',
            projects.collectAbsentWorktrees,
            { every: limits.jobs.collectAbsentWorktrees },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'flush-device-activity',
            access.flushDeviceActivity,
            { every: limits.jobs.flushDeviceActivity, atStop: true },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'open-remote-routes',
            access.openRemoteRoutes,
            { atStart: true, every: limits.jobs.openRemoteRoutes },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'close-remote-routes',
            access.closeRemoteRoutes,
            { atStop: true },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'heartbeat',
            { execute: liveConnections.heartbeat },
            { every: limits.liveUpdates.heartbeat },
            logger,
            observability,
          ),
          yield* makeIntervalJob(
            'ping-live-clients',
            { execute: liveConnections.ping },
            { every: limits.liveUpdates.ping },
            logger,
            observability,
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
          },
          settings,
          files: Context.get(filesystemContext, WebRootReader),
          logger,
          observability,
        });
        return {
          jobs,
          network,
          owner: createOwnerServer({
            application: { ...useCases, reviewTools: reviews },
            logger,
            observability,
            limits,
          }),
          close: () =>
            releaseInOrder([
              routeListenerRunner.close({ route: 'lan' }),
              routeListenerRunner.close({ route: 'tailnet' }),
              worktreeWatches.close(),
              liveConnections.close(),
              lanes.close(),
              gitActions.gitActionWorkflow.stop(),
            ]),
        };
      }),
      (opened) => opened.close(),
    ),
  );
  return components.pipe(Layer.provide(foundation));
}

const openServerWith =
  (adapters: RemoteRouteAdapters, host: ServerHost): OpenServer =>
  (input) =>
    openServerResources(serverResources(adapters, host, input));

export const composeServer =
  (adapters: RemoteRouteAdapters) =>
  (settings: ServerSettings, signal: AbortSignal, host: ServerHost) =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      return yield* startApplication(settings, signal, {
        openServer: openServerWith(adapters, host),
        ownerProbe: new SocketOwnerProbe(),
        clock,
      });
    });

const networkReaders = {
  darwin: (limits: Limits['access']['networkDiscovery']) =>
    macNetworkAddressReaderLayer(limits),
  linux: (_limits: Limits['access']['networkDiscovery']) =>
    osNetworkAddressReaderLayer,
};

export const startServer = composeServer({
  networkAddressReader: networkReaders[readNetworkPlatform()],
  routeListenerRunner: (target) => httpRouteListenerRunnerLayer(target),
  tunnelProbe: (options) => httpTunnelProbeLayer(options),
});
