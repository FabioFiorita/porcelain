import type { PairingReach, RuntimeStatus } from '@porcelain/access/models';
import { createCommitPlanner } from '@porcelain/agents/commit-planning';
import type {
  CommitDraftWriter,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
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
import type { ProjectFolderReader } from '@porcelain/projects/ports';
import { deriveWorktreeId } from '@porcelain/projects/rules';
import { openStorageSession } from '@porcelain/storage';
import { createDeviceStore } from '@porcelain/storage/access';
import { createWorktreeStatusStore } from '@porcelain/storage/changes';
import { createGitActionStore } from '@porcelain/storage/git-actions';
import { createInventoryStore } from '@porcelain/storage/projects';
import { CachedDeviceStore } from '../adapters/access/cached-device-store.ts';
import { HttpPairingReachReader } from '../adapters/access/http-pairing-reach-reader.ts';
import { ProcessRuntimeStatusReader } from '../adapters/access/process-runtime-status-reader.ts';
import { WebSocketEventPublisher } from '../adapters/events/web-socket-event-publisher.ts';
import { ProcessCommitDraftWriter } from '../adapters/git-actions/process-commit-draft-writer.ts';
import { GitLaneKeys } from '../adapters/projects/git-lane-keys.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { GitWorktreeAccess } from '../adapters/projects/git-worktree-access.ts';
import { GitProjectWorktreeReader } from '../adapters/projects/git-project-worktree-reader.ts';
import {
  applicationSettingsSchema,
  operationDeadlineMs,
} from '../config/application-settings.ts';
import { CollectAbsentWorktreesJob } from '../jobs/collect-absent-worktrees-job.ts';
import { FlushDeviceActivityJob } from '../jobs/flush-device-activity-job.ts';
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
  LIVE_UPDATE_LIMITS,
} from './compose-reviews.ts';

const READ_CAPACITY = 4;
const LISTING_LAUNCHES = 4;
const NO_REACH: PairingReach = {
  port: 0,
  policy: { allowedHosts: [], localAddresses: [] },
};

export type ApplicationOptions = {
  dataDirectory: string;
  projectHome: string;
  git?: GitFactory;
  actionGit?: GitActionWriterFactory;
  commitGit?: CommitReaderFactory;
  inspectionGit?: InspectionFactory;
  projectFolderReader?: ProjectFolderReader;
  pairingReach?: () => PairingReach;
  runtimeStatus?: () => RuntimeStatus;
  commitGenerator?: CommitDraftWriter & CommitModelReader;
  now?: () => string;
  signal?: AbortSignal;
  operationTimeoutMs?: number;
  projectListingTimeoutMs?: number;
  gitActionDeadlineMs?: number;
  commitModelDeadlineMs?: number;
};

export type ServerApplication = Awaited<ReturnType<typeof openApplication>>;

export async function openApplication(options: ApplicationOptions) {
  const settings = applicationSettingsSchema.parse(options);
  options.signal?.throwIfAborted();
  const gitVersion = await readGitVersion(options.signal);
  const session = openStorageSession(options.dataDirectory, {
    worktreeId: deriveWorktreeId,
  });
  const inventoryStore = createInventoryStore(session);
  const lanes = new Lanes({
    deadlineMs: () =>
      operationDeadlineMs(inventoryStore.read().projects.length, settings),
    readCapacity: READ_CAPACITY,
    closeResources: () => session.close(),
  });
  const git = options.git ?? ((checkout: string) => new DiscoveryGit(checkout));
  const actionGit: GitActionWriterFactory =
    options.actionGit ?? ((session) => new ActionsGit(session));
  const commitGit: CommitReaderFactory =
    options.commitGit ?? ((checkout) => new HistoryGit(checkout, gitVersion));
  const inspection: InspectionFactory =
    options.inspectionGit ?? ((session) => new InspectionGit(session));
  const clock = new SystemClock();
  const idSource = new RandomIdSource();

  const worktreeDirectory = new GitProjectWorktreeReader({
    git,
    inventoryStore,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(LISTING_LAUNCHES),
    timeoutMs: settings.projectListingTimeoutMs,
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
  const events = new WebSocketEventPublisher({
    worktrees: worktreeAccess,
    pathsChanged: reviewInvalidation.invalidateReviewedMarks,
    projects: () => inventoryStore.read().projects,
    limits: LIVE_UPDATE_LIMITS,
  });
  const devices = new CachedDeviceStore(createDeviceStore(session));
  const readInterruptedGitAction = new ReadInterruptedGitActionService(
    createGitActionStore(session),
  );

  const access = composeAccess({
    session,
    lanes,
    deviceStore: devices,
    deviceActivityStore: devices,
    pairingReachReader: new HttpPairingReachReader(
      options.pairingReach ?? (() => NO_REACH),
    ),
    runtimeStatusReader: new ProcessRuntimeStatusReader(
      options.runtimeStatus ??
        (() => ({
          address: '',
          dataDirectory: options.dataDirectory,
          pid: process.pid,
        })),
    ),
  });
  const projects = composeProjects({
    session,
    lanes,
    laneKeys,
    events,
    git,
    clock,
    idSource,
    worktreeStatusStore: createWorktreeStatusStore(session),
    projectFolderReader: options.projectFolderReader,
    projectHome: options.projectHome,
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
    now: options.now,
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
    commitGenerator:
      options.commitGenerator ??
      new ProcessCommitDraftWriter(createCommitPlanner()),
    gitActionDeadlineMs: settings.gitActionDeadlineMs,
    commitModelDeadlineMs: settings.commitModelDeadlineMs,
  });

  const jobs = [
    new CollectAbsentWorktreesJob(projects.collectAbsentWorktrees),
    new FlushDeviceActivityJob(access.flushDeviceActivity),
  ];
  for (const job of jobs) job.start();
  gitActions.recoverInterruptedGitActions.execute();
  const firstRefresh = projects.refreshInventory.execute({
    signal: options.signal,
  });
  firstRefresh.catch(() => undefined);

  return {
    access,
    projects,
    files,
    changes,
    reviews,
    gitActions,
    liveUpdates: events,
    devices,
    ready: () => firstRefresh,
    close: async () => {
      for (const job of jobs) job.stop();
      devices.flush();
      await events.close();
      await lanes.close();
    },
  };
}
