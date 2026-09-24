import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import {
  CreateCommentThreadService,
  GeneratePublishedReviewService,
  InvalidateReviewedMarksService,
  ListCommentThreadsService,
  ListReviewEvidenceService,
  ListReviewedFilesService,
  ListReviewedLayersService,
  MarkCommentsSeenService,
  PublishReviewService,
  ReadPublishedReviewService,
  ReadReviewLayerService,
  ReadReviewSummaryService,
  ReconcileReviewedFilesService,
  RecordReviewActivityService,
  RemoveReviewedFileService,
  RemoveReviewedLayerService,
  ReplyToCommentService,
  SetReviewedFilesService,
  SetReviewedLayerService,
  UpdateCommentThreadService,
} from '@porcelain/reviews/services';
import type { StorageSession } from '@porcelain/storage';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import type { LiveUpdatesLimits } from '../adapters/events/web-socket-event-publisher.ts';
import { HmacSignatureSource } from '../adapters/reviews/hmac-signature-source.ts';
import { RandomSecretSource } from '../adapters/reviews/random-secret-source.ts';
import { RandomIdSource } from '../adapters/runtime/random-id-source.ts';
import { SystemClock } from '../adapters/runtime/system-clock.ts';
import type { EventPublisher } from '../ports/event-publisher.ts';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
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
import type { composeChanges } from './compose-changes.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];

const limits = {
  comments: {
    threadsPerWorktree: 100,
    messagesPerThread: 100,
    bytesPerWorktree: 1024 * 1024,
  },
  reviewedFiles: { marksPerWorktree: 2000 },
  summaryLink: { lifetimeMs: 60 * 60 * 1000 },
};

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
  checkWorktree: CheckWorktreeService;
  readTextFile: ReadTextFileService;
  changes: ChangesServices;
  now?: (() => string) | undefined;
}) {
  const { lanes, laneKeys, events, readTextFile, changes } = deps;
  const clock = new SystemClock(deps.now);
  const idSource = new RandomIdSource();
  const signatureSource = new HmacSignatureSource();
  const commentStore = createCommentStore(deps.session);
  const reviewStore = createReviewStore(deps.session);
  const reviewedFileStore = createReviewedFileStore(deps.session);
  const reviewedLayerStore = createReviewedLayerStore(deps.session);

  const { checkWorktree } = deps;
  const readPublishedReview = new ReadPublishedReviewService(reviewStore);
  const listReviewEvidence = new ListReviewEvidenceService();
  const generatePublishedReview = new GeneratePublishedReviewService(
    clock,
    signatureSource,
    limits.summaryLink,
  );
  const recordReviewActivity = new RecordReviewActivityService(reviewStore);
  const setReviewedFiles = new SetReviewedFilesService(
    reviewedFileStore,
    clock,
    limits.reviewedFiles,
  );

  return {
    listCommentThreads: new ListCommentThreadsUseCase(
      checkWorktree,
      new ListCommentThreadsService(commentStore),
      lanes,
      laneKeys,
    ),
    createCommentThread: new CreateCommentThreadUseCase(
      checkWorktree,
      new CreateCommentThreadService(
        commentStore,
        idSource,
        clock,
        limits.comments,
      ),
      lanes,
      laneKeys,
      events,
    ),
    replyToComment: new ReplyToCommentUseCase(
      checkWorktree,
      new ReplyToCommentService(commentStore, idSource, clock, limits.comments),
      lanes,
      laneKeys,
      events,
    ),
    resolveCommentThread: new ResolveCommentThreadUseCase(
      checkWorktree,
      new UpdateCommentThreadService(commentStore),
      lanes,
      laneKeys,
      events,
    ),
    markCommentsSeen: new MarkCommentsSeenUseCase(
      checkWorktree,
      new MarkCommentsSeenService(
        createCommentSeenStore(deps.session),
        commentStore,
      ),
      lanes,
      laneKeys,
      events,
    ),
    publishReview: new PublishReviewUseCase(
      checkWorktree,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      listReviewEvidence,
      readTextFile,
      changes.readChangeDiffs,
      new PublishReviewService(
        reviewStore,
        clock,
        idSource,
        new RandomSecretSource(),
      ),
      changes.readEnvironment,
      generatePublishedReview,
      lanes,
      laneKeys,
      events,
    ),
    readPublishedReview: new ReadPublishedReviewUseCase(
      checkWorktree,
      readPublishedReview,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      listReviewEvidence,
      readTextFile,
      changes.readChangeDiffs,
      changes.readEnvironment,
      generatePublishedReview,
      recordReviewActivity,
      lanes,
      laneKeys,
    ),
    refreshReviewActivity: new RefreshReviewActivityUseCase(
      readPublishedReview,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      listReviewEvidence,
      readTextFile,
      changes.readChangeDiffs,
      changes.readEnvironment,
      generatePublishedReview,
      recordReviewActivity,
      lanes,
    ),
    readReviewSummary: new ReadReviewSummaryUseCase(
      new ReadReviewSummaryService(reviewStore, clock, signatureSource),
      lanes,
    ),
    listReviewedFiles: new ListReviewedFilesUseCase(
      checkWorktree,
      new ListReviewedFilesService(reviewedFileStore),
      lanes,
      laneKeys,
    ),
    setReviewedFile: new SetReviewedFileUseCase(
      checkWorktree,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      setReviewedFiles,
      lanes,
      laneKeys,
      events,
    ),
    setReviewedFiles: new SetReviewedFilesUseCase(
      checkWorktree,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      setReviewedFiles,
      lanes,
      laneKeys,
      events,
    ),
    removeReviewedFile: new RemoveReviewedFileUseCase(
      checkWorktree,
      new RemoveReviewedFileService(reviewedFileStore),
      lanes,
      laneKeys,
      events,
    ),
    listReviewedLayers: new ListReviewedLayersUseCase(
      checkWorktree,
      new ListReviewedLayersService(reviewedLayerStore),
      lanes,
      laneKeys,
    ),
    setReviewedLayer: new SetReviewedLayerUseCase(
      checkWorktree,
      new ReadReviewLayerService(reviewStore),
      readTextFile,
      new SetReviewedLayerService(reviewedLayerStore, clock),
      lanes,
      laneKeys,
      events,
    ),
    removeReviewedLayer: new RemoveReviewedLayerUseCase(
      checkWorktree,
      new RemoveReviewedLayerService(reviewedLayerStore),
      lanes,
      laneKeys,
      events,
    ),
  };
}
