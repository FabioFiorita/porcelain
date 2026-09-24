import type { PairingReach, RuntimeStatus } from '@porcelain/access/models';
import { createCommitPlanner } from '@porcelain/agents/commit-planning';
import type {
  CommitDraftWriter,
  CommitModelReader,
} from '@porcelain/git-actions/ports';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import { ActionGit, type GitActionWriterFactory } from '@porcelain/git/actions';
import { Git, type GitFactory } from '@porcelain/git/discovery';
import { CommitGit, type CommitReaderFactory } from '@porcelain/git/history';
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
import { DeviceDirectoryAdapter } from '../adapters/access/device-directory-adapter.ts';
import { PairingReachAdapter } from '../adapters/access/pairing-reach-adapter.ts';
import { RuntimeStatusReaderAdapter } from '../adapters/access/runtime-status-reader-adapter.ts';
import { LiveUpdatesAdapter } from '../adapters/events/live-updates-adapter.ts';
import { CommitGeneratorAdapter } from '../adapters/git-actions/commit-generator-adapter.ts';
import { LaneKeysAdapter } from '../adapters/projects/lane-keys-adapter.ts';
import { RandomIdSourceAdapter } from '../adapters/runtime/random-id-source-adapter.ts';
import { SystemClockAdapter } from '../adapters/runtime/system-clock-adapter.ts';
import { WorktreeAccessAdapter } from '../adapters/projects/worktree-access-adapter.ts';
import { WorktreeDirectoryAdapter } from '../adapters/projects/worktree-directory-adapter.ts';
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
  const git = options.git ?? ((checkout: string) => new Git(checkout));
  const actionGit: GitActionWriterFactory =
    options.actionGit ?? ((session) => new ActionGit(session));
  const commitGit: CommitReaderFactory =
    options.commitGit ?? ((checkout) => new CommitGit(checkout));
  const inspection: InspectionFactory =
    options.inspectionGit ?? ((session) => new InspectionGit(session));
  const clock = new SystemClockAdapter();
  const idSource = new RandomIdSourceAdapter();

  const worktreeDirectory = new WorktreeDirectoryAdapter({
    git,
    inventoryStore,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(LISTING_LAUNCHES),
    timeoutMs: settings.projectListingTimeoutMs,
    worktreeId: deriveWorktreeId,
  });
  const worktreeAccess = new WorktreeAccessAdapter(
    worktreeDirectory,
    inventoryStore,
  );
  const laneKeys = new LaneKeysAdapter(worktreeDirectory, inventoryStore);
  const reviewInvalidation = composeReviewInvalidation({
    session,
    lanes,
    laneKeys,
  });
  const events = new LiveUpdatesAdapter({
    worktrees: worktreeAccess,
    pathsChanged: reviewInvalidation.invalidateReviewedMarksController,
    projects: () => inventoryStore.read().projects,
    limits: LIVE_UPDATE_LIMITS,
  });
  const devices = new DeviceDirectoryAdapter(createDeviceStore(session));
  const readInterruptedGitAction = new ReadInterruptedGitActionService(
    createGitActionStore(session),
  );

  const access = composeAccess({
    session,
    lanes,
    deviceStore: devices,
    deviceActivityStore: devices,
    pairingReachReader: new PairingReachAdapter(
      options.pairingReach ?? (() => NO_REACH),
    ),
    runtimeStatusReader: new RuntimeStatusReaderAdapter(
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
    worktreeAccess,
  });
  const files = composeFiles({ lanes, laneKeys, events, worktreeAccess });
  const changes = composeChanges({
    session,
    lanes,
    laneKeys,
    worktreeAccess,
    inventory: inventoryStore,
    inspection,
    commitGit,
    readTextFile: files.readTextFileService,
    reconcileReviewedFiles: reviewInvalidation.reconcileReviewedFiles,
    readInterruptedGitAction,
  });
  const reviews = composeReviews({
    session,
    lanes,
    laneKeys,
    events,
    worktreeAccess,
    readTextFile: files.readTextFileService,
    changes: changes.services,
    now: options.now,
  });
  const gitActions = composeGitActions({
    session,
    lanes,
    laneKeys,
    events,
    worktreeAccess,
    actionGit,
    fileReader: files.fileReader,
    changes: changes.services,
    refreshPublishedReview: reviews.refreshReviewActivityController,
    commitGenerator:
      options.commitGenerator ??
      new CommitGeneratorAdapter(createCommitPlanner()),
    gitActionDeadlineMs: settings.gitActionDeadlineMs,
    commitModelDeadlineMs: settings.commitModelDeadlineMs,
  });

  const jobs = [
    new CollectAbsentWorktreesJob(projects.collectAbsentWorktreesController),
    new FlushDeviceActivityJob(access.flushDeviceActivityController),
  ];
  for (const job of jobs) job.start();
  gitActions.recoverInterruptedGitActionsController.execute();
  const firstRefresh = projects.refreshInventoryController.execute({
    signal: options.signal,
  });
  firstRefresh.catch(() => undefined);

  return {
    authenticateDeviceController: access.authenticateDeviceController,
    checkRequestOriginController: access.checkRequestOriginController,
    readOwnerStatusController: access.readOwnerStatusController,
    issuePairingController: access.issuePairingController,
    listAccessController: access.listAccessController,
    readHealthController: access.readHealthController,
    redeemPairingController: access.redeemPairingController,
    revokeAccessController: access.revokeAccessController,
    readInventoryController: projects.readInventoryController,
    resolveWorktreeByPathController: projects.resolveWorktreeByPathController,
    registerProjectController: projects.registerProjectController,
    renameProjectController: projects.renameProjectController,
    removeProjectController: projects.removeProjectController,
    discoverProjectsController: projects.discoverProjectsController,
    browseProjectFoldersController: projects.browseProjectFoldersController,
    listFilePreferencesController: projects.listFilePreferencesController,
    setFilePreferenceController: projects.setFilePreferenceController,
    listDirectoryController: files.listDirectoryController,
    readTextFileController: files.readTextFileController,
    readFileAssetController: files.readFileAssetController,
    readPreviewAssetsController: files.readPreviewAssetsController,
    editFileController: files.editFileController,
    listWorktreePathsController: files.listWorktreePathsController,
    readChangesController: changes.readChangesController,
    readChangeDiffsController: changes.readChangeDiffsController,
    readChangeLinesController: changes.readChangeLinesController,
    readGitStatusController: changes.readGitStatusController,
    listCommitsController: changes.listCommitsController,
    readCommitFilesController: changes.readCommitFilesController,
    readCommitDiffsController: changes.readCommitDiffsController,
    listCommentThreadsController: reviews.listCommentThreadsController,
    createCommentThreadController: reviews.createCommentThreadController,
    replyToCommentController: reviews.replyToCommentController,
    resolveCommentThreadController: reviews.resolveCommentThreadController,
    markCommentsSeenController: reviews.markCommentsSeenController,
    publishReviewController: reviews.publishReviewController,
    readPublishedReviewController: reviews.readPublishedReviewController,
    readReviewSummaryController: reviews.readReviewSummaryController,
    listReviewedFilesController: reviews.listReviewedFilesController,
    setReviewedFileController: reviews.setReviewedFileController,
    setReviewedFilesController: reviews.setReviewedFilesController,
    removeReviewedFileController: reviews.removeReviewedFileController,
    listReviewedLayersController: reviews.listReviewedLayersController,
    setReviewedLayerController: reviews.setReviewedLayerController,
    removeReviewedLayerController: reviews.removeReviewedLayerController,
    runGitActionController: gitActions.runGitActionController,
    readGitActionReceiptController: gitActions.readGitActionReceiptController,
    dismissInterruptedGitActionController:
      gitActions.dismissInterruptedGitActionController,
    listGitBranchesController: gitActions.listGitBranchesController,
    listCommitModelsController: gitActions.listCommitModelsController,
    generateCommitDraftController: gitActions.generateCommitDraftController,
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
