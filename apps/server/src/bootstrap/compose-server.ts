import { createCommitPlanner } from '@porcelain/agents/commit-planning';
import { readGitVersion } from '@porcelain/git/discovery';
import { ConfirmWorktreeService } from '@porcelain/projects/services';
import { gitDirectoryName, isTemporaryWrite } from '@porcelain/kernel/rules';
import { deriveWorktreeId } from '@porcelain/projects/rules';
import { openStorageSession } from '@porcelain/storage';
import { SocketOwnerProbe } from '../adapters/access/socket-owner-probe.ts';
import { InMemoryDeviceConnectionStore } from '../adapters/access/in-memory-device-connection-store.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
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
import { createOwnerServer } from '../http/owner-server.ts';
import { createNetworkServer } from '../http/server.ts';
import { IntervalJob, JobSequence } from '../runtime/interval-job.ts';
import type { Job } from '../runtime/job.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import {
  LiveConnections,
  LiveHeartbeat,
  LivePing,
} from '../runtime/live-updates/live-connections.ts';
import { WatchWorktrees } from '../runtime/live-updates/watch-worktrees.ts';
import type { StartServer } from '../cli/launcher.ts';
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

export const openServer: OpenServer = async (input) => {
  const { settings } = input;
  const { limits } = settings;
  const worktreeId = (projectId: string, metadataIdentity: string) =>
    deriveWorktreeId(
      projectId,
      metadataIdentity,
      limits.projects.worktreeIds.length,
    );
  const gitVersion = await readGitVersion(input.signal);
  const session = openStorageSession(settings.dataDirectory);
  const stores = composeStores(session);
  const catalog = new InMemoryWorktreeCatalogStore();
  const clock = new SystemClock();
  const lanes = new Lanes({
    deadlineMs: () =>
      operationDeadlineMs(catalog.listObservations().length, limits),
    readCapacity: limits.lanes.readCapacity,
    consistency: new ConfirmWorktreeService(catalog),
    closeResources: () => session.close(),
  });
  const logger = new StderrLogger(clock);
  const liveConnections = new LiveConnections();
  const events = new WebSocketEventPublisher(liveConnections);
  const shared = composeShared({
    settings,
    stores,
    catalog,
    gitVersion,
    worktreeId,
    clock,
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
  const access = composeAccess(context, {
    stores,
    shared,
    deviceConnections,
    pairingReachReader: new HttpPairingReachReader(input.pairingReach),
    runtimeStatusReader: new ProcessRuntimeStatusReader(input.runtimeStatus),
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
    reviews.invalidateReviewedMarks,
    projects.refreshInventory,
    events,
    new ParcelWorktreeWatcher({
      worktrees: shared.worktreeAccess,
      projects: () => catalog.listObservations(),
      gitDirectory: gitDirectoryName(),
      isTemporaryWrite,
    }),
    logger,
    limits.liveUpdates,
  );
  const files = composeFiles(context, {
    shared,
    checkWorktree,
    invalidateReviewedMarks: reviews.invalidateReviewedMarks,
    announcedEdits: worktreeWatches,
  });
  const commitPlanner = createCommitPlanner();
  const gitActions = composeGitActions(context, {
    stores,
    shared,
    checkWorktree,
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
  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
    network: createNetworkServer({
      application: {
        ...useCases,
        liveUpdates: liveConnections,
        worktreeWatches,
        deviceConnections,
        logger,
      },
      settings,
      files: new FilesystemWebRootReader(settings.webRoot),
      logger,
    }),
    owner: createOwnerServer({ application: useCases, logger }),
    close: async () => {
      await worktreeWatches.close();
      liveConnections.close();
      await lanes.close();
    },
  };
};

export const startServer: StartServer = (settings, signal) =>
  startApplication(settings, signal, {
    openServer,
    ownerProbe: new SocketOwnerProbe(),
    clock: new SystemClock(),
  });
