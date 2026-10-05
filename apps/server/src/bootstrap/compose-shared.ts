import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import {
  ChangeStatusReader,
  WorktreeSideReader,
  ReadChangeFingerprintsOptions,
  ChangeDiffReader,
  BranchRangeReader,
} from '@porcelain/changes/ports';
import {
  ReviewStore,
  ReviewedLayerStore,
  CommentStore,
  CommentSeenStore,
  ReviewedFileStore,
} from '@porcelain/reviews/ports';
import {
  FileReader,
  HeadTextReader,
  ReadTextFileOptions,
  ReadTextFilesOptions,
  ReadBinaryFilesOptions,
} from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import {
  EnvironmentIdentityReader,
  EnvironmentNameStore,
  HostNameReader,
} from '@porcelain/access/ports';
import {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { Clock } from '@porcelain/kernel/ports';
import { OsHostNameReader } from '../adapters/access/os-host-name-reader.ts';
import {
  ReadBranchChangesService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
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
  WorktreeCatalogStore,
  InventoryStore,
  CheckWorktreeOptions,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
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
import { GitBranchRangeReader } from '../adapters/changes/git-branch-range-reader.ts';
import { GitChangeDiffReader } from '../adapters/changes/git-change-diff-reader.ts';
import { GitChangeStatusReader } from '../adapters/changes/git-change-status-reader.ts';
import { GitWorktreeSideReader } from '../adapters/changes/git-worktree-side-reader.ts';
import { inspectionCheckouts } from '../adapters/changes/inspection-checkouts.ts';
import { gitSessionPerSignal } from '../adapters/projects/checkout-session.ts';
import {
  ReadBinaryFilesService,
  ReadTextFileService,
  ReadTextFilesService,
} from '@porcelain/files/services';
import { FilesystemFileReader } from '../adapters/files/filesystem-file-reader.ts';
import { GitHeadTextReader } from '../adapters/files/git-head-text-reader.ts';
import { GitWorktreeAccessReader } from '../adapters/projects/git-worktree-access-reader.ts';
import { GitWorktreeListingReader } from '../adapters/projects/git-worktree-listing-reader.ts';
import { type WorktreeListing } from '@porcelain/projects/models';
import { type ServerSettings } from '../config/server-settings.ts';
import { type Logger } from '../ports/logger.ts';
import { LaunchLimit } from '../runtime/launch-limit.ts';
import { SharedReads } from '../runtime/shared-reads.ts';
import { ReadReviewEvidenceUseCase } from '../use-cases/reviews/read-review-evidence.ts';
import { type Stores } from './compose-stores.ts';

export type Shared = Effect.Success<ReturnType<typeof composeShared>>;

type SharedDependencies = {
  settings: ServerSettings;
  stores: Stores;
  catalog: WorktreeCatalogStore;
  gitVersion: Awaited<ReturnType<typeof readGitVersion>>;
  worktreeId: (projectId: string, metadataIdentity: string) => string;
  clock: Clock;
  logger: Logger;
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
  const inventoryReads = new SharedReads<WorktreeListing>();
  const worktreeListing = new GitWorktreeListingReader({
    git,
    sharedReads: inventoryReads,
    launchLimit: new LaunchLimit(limits.inventory.listingLaunches),
    timeoutMs: limits.inventory.listingTimeoutMs,
    worktreeId: dependencies.worktreeId,
    logger: dependencies.logger,
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
  const branchRangeReader = new GitBranchRangeReader(worktreeAccess, commitGit);
  const ports = Layer.mergeAll(
    Layer.succeed(FileReader, fileReader),
    Layer.succeed(HeadTextReader, new GitHeadTextReader(openInspection)),
    Layer.succeed(ReadTextFileOptions, limits.files.readTextFile),
    Layer.succeed(ReadTextFilesOptions, limits.files.readTextFile),
    Layer.succeed(ChangeStatusReader, changeStatusReader),
    Layer.succeed(
      WorktreeSideReader,
      new GitWorktreeSideReader(openInspection, limits.changes.worktreeReads),
    ),
    Layer.succeed(ReadChangeFingerprintsOptions, limits.changes.fingerprints),
    Layer.succeed(ChangeDiffReader, new GitChangeDiffReader(openInspection)),
    Layer.succeed(WorktreeCatalogStore, catalog),
    Layer.succeed(InventoryStore, stores.inventory),
    Layer.succeed(Clock, dependencies.clock),
    Layer.succeed(CheckWorktreeOptions, staleness),
    Layer.succeed(BranchRangeReader, branchRangeReader),
    Layer.succeed(GitActionReceiptStore, stores.gitActions),
    Layer.succeed(WorktreePresenceStore, stores.worktreePresence),
    Layer.succeed(ReviewStore, stores.reviews),
    Layer.succeed(ReviewedLayerStore, stores.reviewedLayers),
    Layer.succeed(CommentStore, stores.comments),
    Layer.succeed(CommentSeenStore, stores.commentsSeen),
    Layer.succeed(ReadBinaryFilesOptions, limits.reviews.proof),
    Layer.succeed(ReviewedFileStore, stores.reviewedFiles),
  );
  const native = Layer.mergeAll(
    ReadEnvironmentService.layer,
    ReadEnvironmentNameService.layer,
  )
    .pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          Layer.succeed(
            EnvironmentIdentityReader,
            dependencies.stores.environmentIdentity,
          ),
          Layer.succeed(
            EnvironmentNameStore,
            dependencies.stores.environmentName,
          ),
          Layer.succeed(HostNameReader, new OsHostNameReader()),
        ),
      ),
    )
    .pipe(Layer.provideMerge(ports));
  const services = Layer.mergeAll(
    ReadTextFileService.layer,
    ReadTextFilesService.layer,
    ReadWorktreeStatusService.layer,
    ReadChangeFingerprintsService.layer,
    ReadChangeDiffsService.layer,
    CheckWorktreeService.layer,
    ConfirmWorktreeService.layer,
    CheckRefreshedWorktreeService.layer,
    ReadBranchChangesService.layer,
    ReadInterruptedGitActionService.layer,
    ListRegisteredProjectsService.layer,
    ListKnownWorktreesService.layer,
    ListRecordedWorktreesService.layer,
    ReadReviewBadgesService.layer,
    ReadPublishedReviewService.layer,
    ListReviewedLayerPathsService.layer,
    ReadBinaryFilesService.layer,
    RecordReviewActivityService.layer,
    InvalidateReviewedMarksService.layer,
  ).pipe(Layer.provideMerge(native));
  const operations = Layer.mergeAll(ReadReviewEvidenceUseCase.layer).pipe(
    Layer.provideMerge(services),
  );
  return Effect.gen(function* () {
    return {
      git,
      actionGit,
      commitGit,
      catalog,
      worktreeListing,
      inventoryReads,
      worktreeAccess,
      gitSessions,
      openInspection,
      changeStatusReader,
      fileReader,
      checkWorktreeService: yield* CheckWorktreeService,
      confirmWorktree: yield* ConfirmWorktreeService,
      checkRefreshedWorktree: yield* CheckRefreshedWorktreeService,
      readEnvironment: yield* ReadEnvironmentService,
      readEnvironmentName: yield* ReadEnvironmentNameService,
      hostNames: yield* HostNameReader,
      readTextFileService: yield* ReadTextFileService,
      readWorktreeStatus: yield* ReadWorktreeStatusService,
      readChangeFingerprints: yield* ReadChangeFingerprintsService,
      branchRangeReader,
      readBranchChanges: yield* ReadBranchChangesService,
      readChangeDiffs: yield* ReadChangeDiffsService,
      readInterruptedGitAction: yield* ReadInterruptedGitActionService,
      listRegisteredProjects: yield* ListRegisteredProjectsService,
      listKnownWorktrees: yield* ListKnownWorktreesService,
      listRecordedWorktrees: yield* ListRecordedWorktreesService,
      readWorktreeStatuses: yield* ReadReviewBadgesService,
      readPublishedReview: yield* ReadPublishedReviewService,
      listReviewedLayerPaths: yield* ListReviewedLayerPathsService,
      readTextFilesService: yield* ReadTextFilesService,
      readBinaryFiles: yield* ReadBinaryFilesService,
      readReviewEvidence: yield* ReadReviewEvidenceUseCase,
      recordReviewActivity: yield* RecordReviewActivityService,
      invalidateReviewedMarks: yield* InvalidateReviewedMarksService,
    };
  }).pipe(Effect.provide(operations));
}
