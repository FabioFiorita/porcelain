import type { ReadTextFileService } from '@porcelain/files/services';
import type { ListableProject } from '@porcelain/projects/models';
import type { WorktreeAccess } from '@porcelain/reviews/ports';
import {
  CheckWorktreeAccessService,
  CreateCommentThreadService,
  InvalidateReviewedMarksService,
  ListCommentThreadsService,
  ListReviewedFilesService,
  ListReviewedLayersService,
  MarkCommentsSeenService,
  PublishReviewService,
  ReadCurrentChangesService,
  ReadPublishedReviewService,
  ReadReviewChangesService,
  ReadReviewFilesService,
  ReadReviewPatchesService,
  ReadReviewSummaryService,
  ReconcileReviewedFilesService,
  RecordReviewActivityService,
  RemoveReviewedFileService,
  RemoveReviewedLayerService,
  ReplyToCommentService,
  ResolveCommentThreadService,
  ResolvePublishedReviewService,
  SetReviewedFilesService,
  SetReviewedLayerService,
} from '@porcelain/reviews/services';
import type { StorageSession } from '@porcelain/storage';
import { createEnvironmentIdentityStore } from '@porcelain/storage/access';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import {
  LiveUpdatesAdapter,
  type LiveUpdatesLimits,
} from '../adapters/events/live-updates-adapter.ts';
import { ChangeDiffAdapter } from '../adapters/reviews/change-diff-adapter.ts';
import { ClockAdapter } from '../adapters/reviews/clock-adapter.ts';
import { IdSourceAdapter } from '../adapters/reviews/id-source-adapter.ts';
import { SecretSourceAdapter } from '../adapters/reviews/secret-source-adapter.ts';
import { WorktreeChangeAdapter } from '../adapters/reviews/worktree-change-adapter.ts';
import { WorktreeTextAdapter } from '../adapters/reviews/worktree-text-adapter.ts';
import { CreateCommentThreadController } from '../controllers/create-comment-thread-controller.ts';
import { InvalidateReviewedMarksController } from '../controllers/invalidate-reviewed-marks-controller.ts';
import { ListCommentThreadsController } from '../controllers/list-comment-threads-controller.ts';
import { ListReviewedFilesController } from '../controllers/list-reviewed-files-controller.ts';
import { ListReviewedLayersController } from '../controllers/list-reviewed-layers-controller.ts';
import { MarkCommentsSeenController } from '../controllers/mark-comments-seen-controller.ts';
import { PublishReviewController } from '../controllers/publish-review-controller.ts';
import { ReadPublishedReviewController } from '../controllers/read-published-review-controller.ts';
import { ReadReviewSummaryController } from '../controllers/read-review-summary-controller.ts';
import { RefreshReviewActivityController } from '../controllers/refresh-review-activity-controller.ts';
import { RemoveReviewedFileController } from '../controllers/remove-reviewed-file-controller.ts';
import { RemoveReviewedLayerController } from '../controllers/remove-reviewed-layer-controller.ts';
import { ReplyToCommentController } from '../controllers/reply-to-comment-controller.ts';
import { ResolveCommentThreadController } from '../controllers/resolve-comment-thread-controller.ts';
import { SetReviewedFileController } from '../controllers/set-reviewed-file-controller.ts';
import { SetReviewedFilesController } from '../controllers/set-reviewed-files-controller.ts';
import { SetReviewedLayerController } from '../controllers/set-reviewed-layer-controller.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';

const LIVE_UPDATE_LIMITS: LiveUpdatesLimits = {
  maxConnections: 64,
  maxWatchedWorktrees: 64,
  burstMs: 150,
  heartbeatMs: 25_000,
};

type LiveUpdatesOptions = ConstructorParameters<typeof LiveUpdatesAdapter>[0];

export function composeReviews(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  worktreeAccess: WorktreeAccess & LiveUpdatesOptions['worktrees'];
  projects: () => readonly ListableProject[];
  readTextFile: ReadTextFileService;
  readChanges: ConstructorParameters<typeof WorktreeChangeAdapter>[0];
  readChangeDiffs: ConstructorParameters<typeof ChangeDiffAdapter>[0];
  now?: (() => string) | undefined;
}) {
  const { lanes, laneKeys } = deps;
  const clock = new ClockAdapter(deps.now);
  const idSource = new IdSourceAdapter();
  const commentStore = createCommentStore(deps.session);
  const reviewStore = createReviewStore(deps.session);
  const reviewedFileStore = createReviewedFileStore(deps.session);
  const reviewedLayerStore = createReviewedLayerStore(deps.session);
  const worktreeChanges = new WorktreeChangeAdapter(deps.readChanges);

  const checkWorktreeAccess = new CheckWorktreeAccessService(
    deps.worktreeAccess,
  );
  const readReviewFiles = new ReadReviewFilesService(
    new WorktreeTextAdapter(deps.readTextFile),
  );
  const readReviewChanges = new ReadReviewChangesService(worktreeChanges);
  const readCurrentChanges = new ReadCurrentChangesService(worktreeChanges);
  const readReviewPatches = new ReadReviewPatchesService(
    new ChangeDiffAdapter(deps.readChangeDiffs),
  );
  const readPublishedReview = new ReadPublishedReviewService(reviewStore);
  const resolvePublishedReview = new ResolvePublishedReviewService(
    createEnvironmentIdentityStore(deps.session),
    clock,
  );
  const recordReviewActivity = new RecordReviewActivityService(reviewStore);
  const setReviewedFiles = new SetReviewedFilesService(
    reviewedFileStore,
    clock,
  );

  const invalidateReviewedMarksController =
    new InvalidateReviewedMarksController(
      new InvalidateReviewedMarksService(reviewedFileStore, reviewedLayerStore),
      lanes,
      laneKeys,
    );
  const liveUpdates = new LiveUpdatesAdapter({
    worktrees: deps.worktreeAccess,
    pathsChanged: invalidateReviewedMarksController,
    projects: deps.projects,
    limits: LIVE_UPDATE_LIMITS,
  });

  return {
    liveUpdates,
    invalidateReviewedMarksController,
    reconcileReviewedFiles: new ReconcileReviewedFilesService(
      reviewedFileStore,
    ),
    listCommentThreadsController: new ListCommentThreadsController(
      checkWorktreeAccess,
      new ListCommentThreadsService(commentStore),
      lanes,
      laneKeys,
    ),
    createCommentThreadController: new CreateCommentThreadController(
      checkWorktreeAccess,
      new CreateCommentThreadService(commentStore, idSource, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    replyToCommentController: new ReplyToCommentController(
      checkWorktreeAccess,
      new ReplyToCommentService(commentStore, idSource, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    resolveCommentThreadController: new ResolveCommentThreadController(
      checkWorktreeAccess,
      new ResolveCommentThreadService(commentStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    markCommentsSeenController: new MarkCommentsSeenController(
      checkWorktreeAccess,
      new MarkCommentsSeenService(
        createCommentSeenStore(deps.session),
        commentStore,
      ),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    publishReviewController: new PublishReviewController(
      checkWorktreeAccess,
      readReviewFiles,
      new PublishReviewService(
        reviewStore,
        clock,
        idSource,
        new SecretSourceAdapter(),
      ),
      readReviewChanges,
      readReviewPatches,
      resolvePublishedReview,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    readPublishedReviewController: new ReadPublishedReviewController(
      checkWorktreeAccess,
      readPublishedReview,
      readReviewChanges,
      readReviewPatches,
      readReviewFiles,
      resolvePublishedReview,
      recordReviewActivity,
      lanes,
      laneKeys,
    ),
    refreshReviewActivityController: new RefreshReviewActivityController(
      readPublishedReview,
      readReviewChanges,
      readReviewPatches,
      readReviewFiles,
      resolvePublishedReview,
      recordReviewActivity,
      lanes,
    ),
    readReviewSummaryController: new ReadReviewSummaryController(
      new ReadReviewSummaryService(reviewStore, clock),
      lanes,
    ),
    listReviewedFilesController: new ListReviewedFilesController(
      checkWorktreeAccess,
      new ListReviewedFilesService(reviewedFileStore),
      lanes,
      laneKeys,
    ),
    setReviewedFileController: new SetReviewedFileController(
      checkWorktreeAccess,
      readCurrentChanges,
      setReviewedFiles,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    setReviewedFilesController: new SetReviewedFilesController(
      checkWorktreeAccess,
      readCurrentChanges,
      setReviewedFiles,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    removeReviewedFileController: new RemoveReviewedFileController(
      checkWorktreeAccess,
      new RemoveReviewedFileService(reviewedFileStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    listReviewedLayersController: new ListReviewedLayersController(
      checkWorktreeAccess,
      new ListReviewedLayersService(reviewedLayerStore),
      lanes,
      laneKeys,
    ),
    setReviewedLayerController: new SetReviewedLayerController(
      checkWorktreeAccess,
      readPublishedReview,
      readReviewFiles,
      new SetReviewedLayerService(reviewedLayerStore, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    removeReviewedLayerController: new RemoveReviewedLayerController(
      checkWorktreeAccess,
      new RemoveReviewedLayerService(reviewedLayerStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
  };
}
