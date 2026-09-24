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
import { openStorageSession } from '@porcelain/storage';
import { createDeviceStore } from '@porcelain/storage/access';
import { createWorktreeStatusStore } from '@porcelain/storage/changes';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { createInventoryStore } from '@porcelain/storage/projects';
import { CachedDeviceStore } from '../adapters/access/cached-device-store.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
import { ProcessRuntimeStatusReader } from '../adapters/access/process-runtime-status-reader.ts';
import { ParcelWorktreeWatcher } from '../adapters/events/parcel-worktree-watcher.ts';
import { WebSocketEventPublisher } from '../adapters/events/web-socket-event-publisher.ts';
import { ProcessCommitDraftWriter } from '../adapters/git-actions/process-commit-draft-writer.ts';
import { GitLaneKeys } from '../adapters/projects/git-lane-keys.ts';
import { GitProjectWorktreeReader } from '../adapters/projects/git-project-worktree-reader.ts';
import { GitWorktreeAccess } from '../adapters/projects/git-worktree-access.ts';
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
  const worktreeAccess = new GitWorktreeAccess(
    worktreeDirectory,
    inventoryStore,
  );
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
  const devices = new CachedDeviceStore(createDeviceStore(session));
  const readInterruptedGitAction = new ReadInterruptedGitActionService(
    createGitActionStore(session),
  );

  const access = composeAccess({
    session,
    lanes,
    deviceStore: devices,
    deviceActivityStore: devices,
    pairingReachReader: new HttpPairingReachReader(dependencies.pairingReach),
    runtimeStatusReader: new ProcessRuntimeStatusReader(
      dependencies.runtimeStatus,
    ),
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
    projectHome: settings.projectHome,
    worktreeDirectory,
  });
  const { fileReader, readTextFileService, ...files } = composeFiles({
    lanes,
    laneKeys,
    events,
    worktreeAccess,
  });
  const { services: changeServices, ...changes } = composeChanges({
    session,
    lanes,
    laneKeys,
    worktreeAccess,
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
    worktreeAccess,
    readTextFile: readTextFileService,
    changes: changeServices,
  });
  const gitActions = composeGitActions({
    session,
    lanes,
    laneKeys,
    events,
    worktreeAccess,
    actionGit,
    fileReader,
    changes: changeServices,
    refreshPublishedReview: reviews.refreshReviewActivity,
    commitGenerator: new ProcessCommitDraftWriter(createCommitPlanner()),
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
    devices,
    jobs,
    close: async () => {
      devices.flush();
      await events.close();
      await lanes.close();
    },
  };
}
