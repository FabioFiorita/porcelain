import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadTextFileService } from '@porcelain/files/services';
import type { CheckWorktreeService } from '@porcelain/projects/services';
import {
  CreateCommentThreadService,
  GeneratePublishedReviewService,
  InvalidateReviewedMarksService,
  ListCommentThreadsService,
  ListReviewEvidenceService,
  ListReviewedFilesService,
  ListReviewedLayerPathsService,
  ListReviewedLayersService,
  MarkCommentsSeenService,
  PublishReviewService,
  ReadPublishedReviewService,
  ReadReviewLayerService,
  ReadReviewSummaryService,
  ReconcileReviewedFilesService,
  ReconcileReviewedLayersService,
  RecordReviewActivityService,
  RefreshReviewActivityService,
  RemoveReviewedFileService,
  RemoveReviewedLayerService,
  ReplyToCommentService,
  SetReviewedFilesService,
  SetReviewedLayerService,
  UpdateCommentThreadService,
} from '@porcelain/reviews/services';
import {
  createCommentSeenStore,
  createCommentStore,
  createReviewedFileStore,
  createReviewedLayerStore,
  createReviewStore,
} from '@porcelain/storage/reviews';
import { HmacSignatureSource } from '../adapters/reviews/hmac-signature-source.ts';
import { RandomSecretSource } from '../adapters/reviews/random-secret-source.ts';
import { CreateCommentThreadUseCase } from '../use-cases/reviews/create-comment-thread.ts';
import { InvalidateReviewedMarksUseCase } from '../use-cases/reviews/invalidate-reviewed-marks.ts';
import { ListCommentThreadsUseCase } from '../use-cases/reviews/list-comment-threads.ts';
import { ListReviewedFilesUseCase } from '../use-cases/reviews/list-reviewed-files.ts';
import { ListReviewedLayersUseCase } from '../use-cases/reviews/list-reviewed-layers.ts';
import { MarkCommentsSeenUseCase } from '../use-cases/reviews/mark-comments-seen.ts';
import { PublishReviewUseCase } from '../use-cases/reviews/publish-review.ts';
import { ReadPublishedReviewUseCase } from '../use-cases/reviews/read-published-review.ts';
import { ReadReviewSummaryUseCase } from '../use-cases/reviews/read-review-summary.ts';
import { RemoveReviewedFileUseCase } from '../use-cases/reviews/remove-reviewed-file.ts';
import { RemoveReviewedLayerUseCase } from '../use-cases/reviews/remove-reviewed-layer.ts';
import { ReplyToCommentUseCase } from '../use-cases/reviews/reply-to-comment.ts';
import { ResolveCommentThreadUseCase } from '../use-cases/reviews/resolve-comment-thread.ts';
import { SetReviewedFileUseCase } from '../use-cases/reviews/set-reviewed-file.ts';
import { SetReviewedFilesUseCase } from '../use-cases/reviews/set-reviewed-files.ts';
import { SetReviewedLayerUseCase } from '../use-cases/reviews/set-reviewed-layer.ts';
import type { composeChanges } from './compose-changes.ts';
import type { ComposeContext } from './compose-context.ts';

type ChangesServices = ReturnType<typeof composeChanges>['services'];

export type ReviewsAdapters = {
  checkWorktree: CheckWorktreeService;
  readEnvironment: ReadEnvironmentService;
  readTextFile: ReadTextFileService;
  changes: ChangesServices;
};

export function composeReviewInvalidation(context: ComposeContext) {
  const reviewedFileStore = createReviewedFileStore(context.session);
  const invalidateReviewedMarks = new InvalidateReviewedMarksService(
    reviewedFileStore,
    createReviewedLayerStore(context.session),
  );
  return {
    invalidateReviewedMarks: new InvalidateReviewedMarksUseCase(
      invalidateReviewedMarks,
      context.lanes,
      context.laneKeys,
    ),
    services: {
      invalidateReviewedMarks,
      reconcileReviewedFiles: new ReconcileReviewedFilesService(
        reviewedFileStore,
      ),
    },
  };
}

export function composeReviews(
  context: ComposeContext,
  adapters: ReviewsAdapters,
) {
  const { session, lanes, laneKeys, events, clock, ids } = context;
  const limits = context.settings.limits.reviews;
  const { checkWorktree, readEnvironment, readTextFile, changes } = adapters;
  const signatureSource = new HmacSignatureSource();
  const commentStore = createCommentStore(session);
  const reviewStore = createReviewStore(session);
  const reviewedFileStore = createReviewedFileStore(session);
  const reviewedLayerStore = createReviewedLayerStore(session);

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
      new CreateCommentThreadService(commentStore, ids, clock, limits.comments),
      lanes,
      laneKeys,
      events,
    ),
    replyToComment: new ReplyToCommentUseCase(
      checkWorktree,
      new ReplyToCommentService(commentStore, ids, clock, limits.comments),
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
        createCommentSeenStore(session),
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
        ids,
        new RandomSecretSource(),
      ),
      readEnvironment,
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
      readEnvironment,
      generatePublishedReview,
      recordReviewActivity,
      lanes,
      laneKeys,
    ),
    readReviewSummary: new ReadReviewSummaryUseCase(
      new ReadReviewSummaryService(reviewStore, clock, signatureSource),
      lanes,
    ),
    listReviewedFiles: new ListReviewedFilesUseCase(
      checkWorktree,
      changes.readWorktreeStatus,
      changes.readChangeFingerprints,
      new ReconcileReviewedFilesService(reviewedFileStore),
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
      new ListReviewedLayerPathsService(reviewStore, reviewedLayerStore),
      readTextFile,
      new ReconcileReviewedLayersService(reviewStore, reviewedLayerStore),
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
    services: {
      readPublishedReview,
      listReviewEvidence,
      refreshReviewActivity: new RefreshReviewActivityService(reviewStore),
    },
  };
}
