import type { PairingReach, RuntimeStatus } from '@porcelain/access/models';
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
import { openStorageSession } from '@porcelain/storage';
import { createDeviceStore } from '@porcelain/storage/access';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import {
  createInventoryStore,
  createWorktreeStatusStore,
} from '@porcelain/storage/projects';
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
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { operationDeadlineMs } from '../config/operation-deadline.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import { CollectAbsentWorktreesJob } from '../jobs/collect-absent-worktrees-job.ts';
import { FlushDeviceActivityJob } from '../jobs/flush-device-activity-job.ts';
import type { Job } from '../jobs/job.ts';
import { StartupJob } from '../jobs/startup-job.ts';
import { WatchWorktreesJob } from '../jobs/watch-worktrees-job.ts';
import { Lanes } from '../runtime/lanes.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import { composeAccess } from './compose-access.ts';
import { composeChanges } from './compose-changes.ts';
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
  const gitVersion = await readGitVersion(dependencies.signal);
  const session = openStorageSession(settings.dataDirectory, {
    worktreeId: deriveWorktreeId,
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

  const worktreeDirectory = new GitProjectWorktreeReader({
    git,
    inventoryStore,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(limits.inventory.listingLaunches),
    timeoutMs: limits.inventory.listingTimeoutMs,
    worktreeId: deriveWorktreeId,
  });
  const worktreeAccess = new GitWorktreeAccessReader(
    worktreeDirectory,
    inventoryStore,
  );
  const checkWorktree = new CheckWorktreeService(worktreeAccess);
  const laneKeys = new GitLaneKeys(worktreeDirectory, inventoryStore);
  const reviewInvalidation = composeReviewInvalidation({
    session,
    lanes,
    laneKeys,
  });
  const events = new WebSocketEventPublisher({ limits: limits.liveUpdates });
  const worktreeWatches = new WatchWorktreesJob(
    reviewInvalidation.invalidateReviewedMarks,
    events,
    new ParcelWorktreeWatcher({
      worktrees: worktreeAccess,
      projects: () => inventoryStore.read().projects,
    }),
    limits.liveUpdates,
  );
  const deviceConnections = new HeldDeviceConnections();
  const readInterruptedGitAction = new ReadInterruptedGitActionService(
    createGitActionStore(session),
  );

  const access = composeAccess({
    session,
    lanes,
    deviceStore: new CachedDeviceStore(createDeviceStore(session)),
    deviceSightingStore: new InMemoryDeviceSightingStore(),
    deviceConnections,
    pairingReachReader: new HttpPairingReachReader(dependencies.pairingReach),
    runtimeStatusReader: new ProcessRuntimeStatusReader(
      dependencies.runtimeStatus,
    ),
    pairingAttemptLimits: limits.pairingAttempts,
  });
  const projects = composeProjects({
    session,
    lanes,
    laneKeys,
    events,
    git,
    clock,
    idSource: ids,
    worktreeStatusStore: createWorktreeStatusStore(session),
    projectFolderReader: new FilesystemProjectFolderReader(),
    projectHome: settings.projectHome,
    worktreeDirectory,
  });
  const { fileReader, readTextFileService, ...files } = composeFiles({
    lanes,
    laneKeys,
    events,
    worktreeAccess,
    checkWorktree,
  });
  const { services: changeServices, ...changes } = composeChanges({
    session,
    lanes,
    laneKeys,
    worktreeAccess,
    checkWorktree,
    inventory: inventoryStore,
    inspection,
    commitGit,
    readTextFile: readTextFileService,
    reconcileReviewedFiles: reviewInvalidation.reconcileReviewedFiles,
    readInterruptedGitAction,
  });
  const reviews = composeReviews({
    session,
    lanes,
    laneKeys,
    events,
    checkWorktree,
    readTextFile: readTextFileService,
    changes: changeServices,
  });
  const commitPlanner = createCommitPlanner();
  const gitActions = composeGitActions({
    session,
    lanes,
    laneKeys,
    events,
    worktreeAccess,
    checkWorktree,
    actionGit,
    fileReader,
    changes: changeServices,
    refreshPublishedReview: reviews.refreshReviewActivity,
    commitDraftSource: new ProcessCommitDraftSource(commitPlanner),
    commitModelReader: new ProcessCommitModelReader(commitPlanner),
    gitActionDeadlineMs: limits.gitActions.deadlineMs,
    commitModelDeadlineMs: limits.gitActions.commitModelDeadlineMs,
  });
  const jobs: readonly Job[] = [
    worktreeWatches,
    new StartupJob(
      gitActions.recoverInterruptedGitActions,
      projects.refreshInventory,
      events,
    ),
    new CollectAbsentWorktreesJob(projects.collectAbsentWorktrees, events, {
      intervalMs: limits.jobs.collectAbsentWorktreesMs,
    }),
    new FlushDeviceActivityJob(access.flushDeviceActivity, events, {
      intervalMs: limits.jobs.flushDeviceActivityMs,
    }),
  ];

  return {
    access,
    projects,
    files,
    changes,
    reviews,
    gitActions,
    liveUpdates: events,
    worktreeWatches,
    deviceConnections,
    jobs,
    close: async () => {
      await events.close();
      await lanes.close();
    },
  };
}
