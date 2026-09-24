import type { PairingReach, RuntimeStatus } from '@porcelain/access/models';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { createCommitPlanner } from '@porcelain/agents/commit-planning';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import {
  ActionsGit,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import {
  DiscoveryGit,
  readGitVersion,
  type GitFactory,
} from '@porcelain/git/discovery';
import { HistoryGit, type CommitReaderFactory } from '@porcelain/git/history';
import {
  InspectionGit,
  type InspectionFactory,
} from '@porcelain/git/inspection';
import { deriveWorktreeId } from '@porcelain/projects/rules';
import { CheckWorktreeService } from '@porcelain/projects/services';
import { ReadWorktreeStatusesService } from '@porcelain/reviews/services';
import { openStorageSession } from '@porcelain/storage';
import {
  createDeviceStore,
  createEnvironmentIdentityStore,
} from '@porcelain/storage/access';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { createInventoryStore } from '@porcelain/storage/projects';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import { CachedDeviceStore } from '../adapters/access/cached-device-store.ts';
import { HeldDeviceConnections } from '../adapters/access/held-device-connections.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
import { InMemoryDeviceSightingStore } from '../adapters/access/in-memory-device-sighting-store.ts';
import { ProcessRuntimeStatusReader } from '../adapters/access/process-runtime-status-reader.ts';
import { ParcelWorktreeWatcher } from '../adapters/events/parcel-worktree-watcher.ts';
import { WebSocketEventPublisher } from '../adapters/events/web-socket-event-publisher.ts';
import { ProcessCommitDraftSource } from '../adapters/git-actions/process-commit-draft-source.ts';
import { ProcessCommitModelReader } from '../adapters/git-actions/process-commit-model-reader.ts';
import { FilesystemProjectFolderReader } from '../adapters/projects/filesystem-project-folder-reader.ts';
import { GitLaneKeys } from '../adapters/projects/git-lane-keys.ts';
import { GitProjectWorktreeReader } from '../adapters/projects/git-project-worktree-reader.ts';
import { GitWorktreeAccessReader } from '../adapters/projects/git-worktree-access-reader.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { StderrLogger } from '../adapters/runtime/stderr-logger.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { operationDeadlineMs } from '../config/operation-deadline.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import { IntervalJob } from '../runtime/interval-job.ts';
import type { Job } from '../runtime/job.ts';
import {
  LiveConnections,
  LiveHeartbeat,
  LivePing,
} from '../runtime/live-updates/live-connections.ts';
import { WatchWorktrees } from '../runtime/live-updates/watch-worktrees.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import { composeAccess } from './compose-access.ts';
import { composeChanges } from './compose-changes.ts';
import type { ComposeContext } from './compose-context.ts';
import { composeFiles } from './compose-files.ts';
import { composeGitActions } from './compose-git-actions.ts';
import { composeProjects } from './compose-projects.ts';
import {
  composeReviewInvalidation,
  composeReviews,
} from './compose-reviews.ts';

export type ApplicationDependencies = {
  pairingReach: () => PairingReach;
  runtimeStatus: () => RuntimeStatus;
  signal: AbortSignal;
};

export type ServerApplication = Awaited<ReturnType<typeof openApplication>>;

export async function openApplication(
  settings: ServerSettings,
  dependencies: ApplicationDependencies,
) {
  const { limits } = settings;
  const worktreeId = (projectId: string, metadataIdentity: string) =>
    deriveWorktreeId(
      projectId,
      metadataIdentity,
      limits.projects.worktreeIds.length,
    );
  const gitVersion = await readGitVersion(dependencies.signal);
  const session = openStorageSession(settings.dataDirectory, {
    worktreeId,
  });
  const inventoryStore = createInventoryStore(session);
  const lanes = new Lanes({
    deadlineMs: () =>
      operationDeadlineMs(inventoryStore.read().projects.length, limits),
    readCapacity: limits.lanes.readCapacity,
    closeResources: () => session.close(),
  });
  const git: GitFactory = (checkout) => new DiscoveryGit(checkout);
  const actionGit: GitActionWriterFactory = (checkout) =>
    new ActionsGit(checkout);
  const commitGit: CommitReaderFactory = (checkout) =>
    new HistoryGit(checkout, gitVersion);
  const inspection: InspectionFactory = (checkout) =>
    new InspectionGit(checkout);
  const clock = new SystemClock();
  const ids = new RandomIdSource();
  const logger = new StderrLogger(clock);

  const worktreeDirectory = new GitProjectWorktreeReader({
    git,
    inventoryStore,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(limits.inventory.listingLaunches),
    timeoutMs: limits.inventory.listingTimeoutMs,
    worktreeId,
  });
  const worktreeAccess = new GitWorktreeAccessReader(
    worktreeDirectory,
    inventoryStore,
  );
  const checkWorktree = new CheckWorktreeService(worktreeAccess);
  const laneKeys = new GitLaneKeys(worktreeDirectory, inventoryStore);
  const liveConnections = new LiveConnections();
  const events = new WebSocketEventPublisher(liveConnections);
  const context: ComposeContext = {
    session,
    lanes,
    laneKeys,
    events,
    settings,
    clock,
    ids,
  };
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(session),
  );
  const reviewInvalidation = composeReviewInvalidation(context);
  const deviceConnections = new HeldDeviceConnections();
  const readInterruptedGitAction = new ReadInterruptedGitActionService(
    createGitActionStore(session),
  );

  const access = composeAccess(context, {
    readEnvironment,
    deviceStore: new CachedDeviceStore(createDeviceStore(session)),
    deviceSightingStore: new InMemoryDeviceSightingStore(),
    deviceConnections,
    pairingReachReader: new HttpPairingReachReader(dependencies.pairingReach),
    runtimeStatusReader: new ProcessRuntimeStatusReader(
      dependencies.runtimeStatus,
    ),
  });
  const projects = composeProjects(context, {
    readEnvironment,
    git,
    inventoryStore,
    readWorktreeStatuses: new ReadWorktreeStatusesService(
      createReviewStore(session),
      createReviewedLayerStore(session),
      createCommentStore(session),
      createCommentSeenStore(session),
    ),
    projectFolderReader: new FilesystemProjectFolderReader(),
    worktreeDirectory,
  });
  const { fileReader, readTextFileService, ...files } = composeFiles(context, {
    worktreeAccess,
    checkWorktree,
    invalidateReviewedMarks:
      reviewInvalidation.services.invalidateReviewedMarks,
  });
  const { services: changeServices, ...changes } = composeChanges(context, {
    worktreeAccess,
    checkWorktree,
    readEnvironment,
    inspection,
    commitGit,
    readTextFile: readTextFileService,
    reconcileReviewedFiles: reviewInvalidation.services.reconcileReviewedFiles,
    readInterruptedGitAction,
  });
  const { services: reviewServices, ...reviews } = composeReviews(context, {
    checkWorktree,
    readEnvironment,
    readTextFile: readTextFileService,
    changes: changeServices,
  });
  const commitPlanner = createCommitPlanner();
  const gitActions = composeGitActions(context, {
    logger,
    worktreeAccess,
    checkWorktree,
    inventoryStore,
    actionGit,
    fileReader,
    changes: changeServices,
    readTextFile: readTextFileService,
    reviews: reviewServices,
    commitDraftSource: new ProcessCommitDraftSource(commitPlanner),
    commitModelReader: new ProcessCommitModelReader(commitPlanner),
  });
  const worktreeWatches = new WatchWorktrees(
    reviewInvalidation.invalidateReviewedMarks,
    projects.refreshInventory,
    events,
    new ParcelWorktreeWatcher({
      worktrees: worktreeAccess,
      projects: () => inventoryStore.read().projects,
    }),
    logger,
    limits.liveUpdates,
  );
  const jobs: readonly Job[] = [
    new IntervalJob(
      'recover-interrupted-git-actions',
      gitActions.recoverInterruptedGitActions,
      { atStart: true },
      logger,
    ),
    new IntervalJob(
      'refresh-inventory',
      projects.refreshInventory,
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

  return {
    access,
    projects,
    files,
    changes,
    reviews,
    gitActions,
    liveUpdates: liveConnections,
    logger,
    worktreeWatches,
    deviceConnections,
    jobs,
    close: async () => {
      await worktreeWatches.close();
      liveConnections.close();
      await lanes.close();
    },
  };
}
