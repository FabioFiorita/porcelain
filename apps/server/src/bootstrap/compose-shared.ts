import { ReadEnvironmentService } from '@porcelain/access/services';
import type { Clock } from '@porcelain/kernel/ports';
import {
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import {
  ReadTextFileService,
  ReadTextFilesService,
} from '@porcelain/files/services';
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
import type { WorktreeCatalogStore } from '@porcelain/projects/ports';
import {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
  ConfirmWorktreeService,
  ListKnownWorktreesService,
  ListRecordedWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import {
  InvalidateReviewedMarksService,
  ListReviewedLayerPathsService,
  ReadPublishedReviewService,
  ReadReviewBadgesService,
  RecordReviewActivityService,
} from '@porcelain/reviews/services';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { FilesystemFileReader } from '../adapters/files/filesystem-file-reader.ts';
import { GitHeadTextReader } from '../adapters/files/git-head-text-reader.ts';
import { gitSessionPerSignal } from '../adapters/projects/checkout-session.ts';
import { GitWorktreeAccessReader } from '../adapters/projects/git-worktree-access-reader.ts';
import { GitWorktreeListingReader } from '../adapters/projects/git-worktree-listing-reader.ts';
import type { ServerSettings } from '../config/server-settings.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import { ReadReviewEvidenceUseCase } from '../use-cases/reviews/read-review-evidence.ts';
import type { Stores } from './compose-stores.ts';

export type Shared = ReturnType<typeof composeShared>;

type SharedDependencies = {
  settings: ServerSettings;
  stores: Stores;
  catalog: WorktreeCatalogStore;
  gitVersion: Awaited<ReturnType<typeof readGitVersion>>;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
  clock: Clock;
};

export function composeShared(dependencies: SharedDependencies) {
  const { stores, catalog, gitVersion } = dependencies;
  const { limits } = dependencies.settings;
  const git: GitFactory = (checkout) => new DiscoveryGit(checkout, limits.git);
  const actionGit: GitActionWriterFactory = (checkout) =>
    new ActionsGit(checkout, limits.git);
  const commitGit: CommitReaderFactory = (checkout) =>
    new HistoryGit(checkout, gitVersion, limits.git);
  const inspection: InspectionFactory = (checkout) =>
    new InspectionGit(checkout, limits.git);
  const worktreeListing = new GitWorktreeListingReader({
    git,
    sharedReads: new SharedReads(),
    launchLimit: new LaunchLimit(limits.inventory.listingLaunches),
    timeoutMs: limits.inventory.listingTimeoutMs,
    worktreeId: dependencies.worktreeId,
  });
  const worktreeAccess = new GitWorktreeAccessReader(catalog);
  const staleness = { staleAfterMs: limits.inventory.staleAfterMs };
  const gitSessions = gitSessionPerSignal(limits.git);
  const openInspection = inspectionCheckouts(
    worktreeAccess,
    inspection,
    gitSessions,
  );
  const changeStatusReader = new GitChangeStatusReader(openInspection);
  const fileReader = new FilesystemFileReader(worktreeAccess);
  const readTextFile = new ReadTextFileService(
    fileReader,
    new GitHeadTextReader(openInspection),
    limits.files.readTextFile,
  );
  const readTextFiles = new ReadTextFilesService(
    fileReader,
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
    catalog,
    worktreeListing,
    worktreeAccess,
    gitSessions,
    openInspection,
    changeStatusReader,
    fileReader,
    checkWorktreeService: new CheckWorktreeService(
      catalog,
      stores.inventory,
      dependencies.clock,
      staleness,
    ),
    confirmWorktree: new ConfirmWorktreeService(catalog),
    checkRefreshedWorktree: new CheckRefreshedWorktreeService(
      catalog,
      stores.inventory,
      dependencies.clock,
      staleness,
    ),
    readEnvironment: new ReadEnvironmentService(stores.environmentIdentity),
    readTextFile,
    readWorktreeStatus,
    readChangeFingerprints,
    readChangeDiffs,
    readInterruptedGitAction: new ReadInterruptedGitActionService(
      stores.gitActions,
    ),
    listRegisteredProjects: new ListRegisteredProjectsService(stores.inventory),
    listKnownWorktrees: new ListKnownWorktreesService(catalog),
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
    listReviewedLayerPaths: new ListReviewedLayerPathsService(
      stores.reviews,
      stores.reviewedLayers,
    ),
    readTextFiles,
    readReviewEvidence: new ReadReviewEvidenceUseCase(
      readWorktreeStatus,
      readChangeFingerprints,
      readTextFiles,
      readChangeDiffs,
    ),
    recordReviewActivity: new RecordReviewActivityService(stores.reviews),
    invalidateReviewedMarks: new InvalidateReviewedMarksService(
      stores.reviewedFiles,
    ),
  };
}
