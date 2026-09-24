import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { ReadTextFileService } from '@porcelain/files/services';
import { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';
import {
  ActionsGit,
  type GitActionWriterFactory,
} from '@porcelain/git/actions';
import {
  DiscoveryGit,
  type GitFactory,
  type readGitVersion,
} from '@porcelain/git/discovery';
import { HistoryGit, type CommitReaderFactory } from '@porcelain/git/history';
import {
  InspectionGit,
  type InspectionFactory,
} from '@porcelain/git/inspection';
import {
  CheckWorktreeService,
  ListKnownWorktreesService,
  ListRecordedWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import {
  InvalidateReviewedMarksService,
  ReadPublishedReviewService,
  ReadReviewBadgesService,
  ReadReviewEvidenceService,
  ReconcileReviewedLayersService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { FilesystemFileReader } from '../adapters/files/filesystem-file-reader.ts';
import { GitHeadTextReader } from '../adapters/files/git-head-text-reader.ts';
import { GitWorktreeCatalogStore } from '../adapters/projects/git-project-worktree-reader.ts';
import { GitWorktreeAccessReader } from '../adapters/projects/git-worktree-access-reader.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import type { Stores } from './compose-stores.ts';

export type Shared = ReturnType<typeof composeShared>;

export type SharedDependencies = {
  settings: ServerSettings;
  stores: Stores;
  gitVersion: Awaited<ReturnType<typeof readGitVersion>>;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
};

export function composeShared(dependencies: SharedDependencies) {
  const { stores, gitVersion } = dependencies;
  const { limits } = dependencies.settings;
  const git: GitFactory = (checkout) => new DiscoveryGit(checkout);
  const actionGit: GitActionWriterFactory = (checkout) =>
    new ActionsGit(checkout);
  const commitGit: CommitReaderFactory = (checkout) =>
    new HistoryGit(checkout, gitVersion);
  const inspection: InspectionFactory = (checkout) =>
    new InspectionGit(checkout);
  const worktreeDirectory = new GitWorktreeCatalogStore({
    git,
    inventoryStore: stores.inventory,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(limits.inventory.listingLaunches),
    timeoutMs: limits.inventory.listingTimeoutMs,
    worktreeId: dependencies.worktreeId,
  });
  const worktreeAccess = new GitWorktreeAccessReader(worktreeDirectory);
  const openInspection = inspectionCheckouts(worktreeAccess, inspection);
  const changeStatusReader = new GitChangeStatusReader(openInspection);
  const fileReader = new FilesystemFileReader(worktreeAccess);
  const readTextFile = new ReadTextFileService(
    fileReader,
    new GitHeadTextReader(openInspection),
    limits.files.readTextFile,
  );
  const readWorktreeStatus = new ReadWorktreeStatusService(changeStatusReader);
  const readChangeFingerprints = new ReadChangeFingerprintsService(
    new GitWorktreeSideReader(openInspection, limits.changes.worktreeReads),
    limits.changes.fingerprints,
  );
  const readChangeDiffs = new ReadChangeDiffsService(
    new GitChangeDiffReader(openInspection),
  );
  return {
    git,
    actionGit,
    commitGit,
    worktreeDirectory,
    worktreeAccess,
    openInspection,
    changeStatusReader,
    fileReader,
    checkWorktree: new CheckWorktreeService(worktreeAccess, stores.inventory),
    readEnvironment: new ReadEnvironmentService(stores.environmentIdentity),
    readTextFile,
    readWorktreeStatus,
    readChangeFingerprints,
    readChangeDiffs,
    readInterruptedGitAction: new ReadInterruptedGitActionService(
      stores.gitActions,
    ),
    listRegisteredProjects: new ListRegisteredProjectsService(stores.inventory),
    listKnownWorktrees: new ListKnownWorktreesService(worktreeDirectory),
    listRecordedWorktrees: new ListRecordedWorktreesService(
      stores.worktreePresence,
      stores.inventory,
    ),
    readWorktreeStatuses: new ReadReviewBadgesService(
      stores.reviews,
      stores.reviewedLayers,
      stores.comments,
      stores.commentsSeen,
    ),
    readPublishedReview: new ReadPublishedReviewService(stores.reviews),
    readReviewEvidence: new ReadReviewEvidenceService(
      readWorktreeStatus,
      readChangeFingerprints,
      readTextFile,
      readChangeDiffs,
    ),
    recordReviewActivity: new RecordReviewActivityService(stores.reviews),
    reconcileReviewedLayers: new ReconcileReviewedLayersService(
      stores.reviews,
      stores.reviewedLayers,
    ),
    invalidateReviewedMarks: new InvalidateReviewedMarksService(
      stores.reviewedFiles,
      stores.reviewedLayers,
    ),
  };
}
