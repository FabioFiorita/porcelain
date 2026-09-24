import { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { WorktreeAccess } from '@porcelain/kernel/ports';
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
import type { LiveUpdatesLimits } from '../adapters/events/web-socket-event-publisher.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import { ChangeDiffAdapter } from '../adapters/reviews/change-diff-adapter.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import { RandomSecretSource } from '../adapters/reviews/random-secret-source.ts';
import { WorktreeChangeAdapter } from '../adapters/reviews/worktree-change-adapter.ts';
import { WorktreeTextAdapter } from '../adapters/reviews/worktree-text-adapter.ts';
import { CreateCommentThreadUseCase } from '../use-cases/reviews/create-comment-thread.ts';
import { InvalidateReviewedMarksUseCase } from '../use-cases/reviews/invalidate-reviewed-marks.ts';
import { ListCommentThreadsUseCase } from '../use-cases/reviews/list-comment-threads.ts';
import { ListReviewedFilesUseCase } from '../use-cases/reviews/list-reviewed-files.ts';
import { ListReviewedLayersUseCase } from '../use-cases/reviews/list-reviewed-layers.ts';
import { MarkCommentsSeenUseCase } from '../use-cases/reviews/mark-comments-seen.ts';
import { PublishReviewUseCase } from '../use-cases/reviews/publish-review.ts';
import { ReadPublishedReviewUseCase } from '../use-cases/reviews/read-published-review.ts';
import { ReadReviewSummaryUseCase } from '../use-cases/reviews/read-review-summary.ts';
import { RefreshReviewActivityUseCase } from '../use-cases/reviews/refresh-review-activity.ts';
import { RemoveReviewedFileUseCase } from '../use-cases/reviews/remove-reviewed-file.ts';
import { RemoveReviewedLayerUseCase } from '../use-cases/reviews/remove-reviewed-layer.ts';
import { ReplyToCommentUseCase } from '../use-cases/reviews/reply-to-comment.ts';
import { ResolveCommentThreadUseCase } from '../use-cases/reviews/resolve-comment-thread.ts';
import { SetReviewedFileUseCase } from '../use-cases/reviews/set-reviewed-file.ts';
import { SetReviewedFilesUseCase } from '../use-cases/reviews/set-reviewed-files.ts';
import { SetReviewedLayerUseCase } from '../use-cases/reviews/set-reviewed-layer.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { composeChanges } from './compose-changes.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];

export const LIVE_UPDATE_LIMITS: LiveUpdatesLimits = {
  maxConnections: 64,
  maxWatchedWorktrees: 64,
  burstMs: 150,
  heartbeatMs: 25_000,
};

export function composeReviewInvalidation(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
}) {
  const reviewedFileStore = createReviewedFileStore(deps.session);
  return {
    invalidateReviewedMarks: new InvalidateReviewedMarksUseCase(
      new InvalidateReviewedMarksService(
        reviewedFileStore,
        createReviewedLayerStore(deps.session),
      ),
      deps.lanes,
      deps.laneKeys,
    ),
    reconcileReviewedFiles: new ReconcileReviewedFilesService(
      reviewedFileStore,
    ),
  };
}

export function composeReviews(deps: {
  session: StorageSession;
  lanes: Lanes;
  laneKeys: LaneKeys;
  events: EventPublisher;
  worktreeAccess: WorktreeAccess;
  readTextFile: ReadTextFileService;
  changes: ChangesServices;
  now?: (() => string) | undefined;
}) {
  const { lanes, laneKeys } = deps;
  const clock = new SystemClock(deps.now);
  const idSource = new RandomIdSource();
  const commentStore = createCommentStore(deps.session);
  const reviewStore = createReviewStore(deps.session);
  const reviewedFileStore = createReviewedFileStore(deps.session);
  const reviewedLayerStore = createReviewedLayerStore(deps.session);
  const worktreeChanges = new WorktreeChangeAdapter(deps.changes);

  const checkWorktreeAccess = new CheckWorktreeAccessService(
    deps.worktreeAccess,
  );
  const readReviewFiles = new ReadReviewFilesService(
    new WorktreeTextAdapter(deps.readTextFile),
  );
  const readReviewChanges = new ReadReviewChangesService(worktreeChanges);
  const readCurrentChanges = new ReadCurrentChangesService(worktreeChanges);
  const readReviewPatches = new ReadReviewPatchesService(
    new ChangeDiffAdapter(deps.changes),
  );
  const readPublishedReview = new ReadPublishedReviewService(reviewStore);
  const resolvePublishedReview = new ResolvePublishedReviewService(clock);
  const readEnvironment = new ReadEnvironmentService(
    createEnvironmentIdentityStore(deps.session),
  );
  const recordReviewActivity = new RecordReviewActivityService(reviewStore);
  const setReviewedFiles = new SetReviewedFilesService(
    reviewedFileStore,
    clock,
  );

  const liveUpdates = deps.events;
  return {
    listCommentThreads: new ListCommentThreadsUseCase(
      checkWorktreeAccess,
      new ListCommentThreadsService(commentStore),
      lanes,
      laneKeys,
    ),
    createCommentThread: new CreateCommentThreadUseCase(
      checkWorktreeAccess,
      new CreateCommentThreadService(commentStore, idSource, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    replyToComment: new ReplyToCommentUseCase(
      checkWorktreeAccess,
      new ReplyToCommentService(commentStore, idSource, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    resolveCommentThread: new ResolveCommentThreadUseCase(
      checkWorktreeAccess,
      new ResolveCommentThreadService(commentStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    markCommentsSeen: new MarkCommentsSeenUseCase(
      checkWorktreeAccess,
      new MarkCommentsSeenService(
        createCommentSeenStore(deps.session),
        commentStore,
      ),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    publishReview: new PublishReviewUseCase(
      checkWorktreeAccess,
      readReviewFiles,
      new PublishReviewService(
        reviewStore,
        clock,
        idSource,
        new RandomSecretSource(),
      ),
      readReviewChanges,
      readReviewPatches,
      resolvePublishedReview,
      readEnvironment,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    readPublishedReview: new ReadPublishedReviewUseCase(
      checkWorktreeAccess,
      readPublishedReview,
      readReviewChanges,
      readReviewPatches,
      readReviewFiles,
      resolvePublishedReview,
      recordReviewActivity,
      readEnvironment,
      lanes,
      laneKeys,
    ),
    refreshReviewActivity: new RefreshReviewActivityUseCase(
      readPublishedReview,
      readReviewChanges,
      readReviewPatches,
      readReviewFiles,
      resolvePublishedReview,
      recordReviewActivity,
      readEnvironment,
      lanes,
    ),
    readReviewSummary: new ReadReviewSummaryUseCase(
      new ReadReviewSummaryService(reviewStore, clock),
      lanes,
    ),
    listReviewedFiles: new ListReviewedFilesUseCase(
      checkWorktreeAccess,
      new ListReviewedFilesService(reviewedFileStore),
      lanes,
      laneKeys,
    ),
    setReviewedFile: new SetReviewedFileUseCase(
      checkWorktreeAccess,
      readCurrentChanges,
      setReviewedFiles,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    setReviewedFiles: new SetReviewedFilesUseCase(
      checkWorktreeAccess,
      readCurrentChanges,
      setReviewedFiles,
      lanes,
      laneKeys,
      liveUpdates,
    ),
    removeReviewedFile: new RemoveReviewedFileUseCase(
      checkWorktreeAccess,
      new RemoveReviewedFileService(reviewedFileStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    listReviewedLayers: new ListReviewedLayersUseCase(
      checkWorktreeAccess,
      new ListReviewedLayersService(reviewedLayerStore),
      lanes,
      laneKeys,
    ),
    setReviewedLayer: new SetReviewedLayerUseCase(
      checkWorktreeAccess,
      readPublishedReview,
      readReviewFiles,
      new SetReviewedLayerService(reviewedLayerStore, clock),
      lanes,
      laneKeys,
      liveUpdates,
    ),
    removeReviewedLayer: new RemoveReviewedLayerUseCase(
      checkWorktreeAccess,
      new RemoveReviewedLayerService(reviewedLayerStore),
      lanes,
      laneKeys,
      liveUpdates,
    ),
  };
}
