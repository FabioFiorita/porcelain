import {
  CreateCommentThreadService,
  ResolvePublishedReviewService,
  ListCommentThreadsService,
  ListReviewedFilesService,
  ListReviewedLayersService,
  MarkCommentsSeenService,
  PublishReviewService,
  ReadReviewLayerService,
  ReadReviewSummaryService,
  RemoveReviewedFileService,
  RemoveReviewedLayerService,
  ReplyToCommentService,
  SetReviewedFilesService,
  SetReviewedLayerService,
  UpdateCommentThreadService,
} from '@porcelain/reviews/services';
import { HmacSignatureSource } from '../adapters/reviews/hmac-signature-source.ts';
import { RandomSecretSource } from '../adapters/runtime/random-secret-source.ts';
import { AtWorktreePathUseCase } from '../use-cases/reviews/at-worktree-path.ts';
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
import { RefreshReviewActivityUseCase } from '../use-cases/reviews/refresh-review-activity.ts';
import { RefreshWorktreeReviewUseCase } from '../use-cases/reviews/refresh-worktree-review.ts';
import { ReplyToCommentUseCase } from '../use-cases/reviews/reply-to-comment.ts';
import { SetReviewedFilesUseCase } from '../use-cases/reviews/set-reviewed-files.ts';
import { SetReviewedLayerUseCase } from '../use-cases/reviews/set-reviewed-layer.ts';
import { UpdateCommentThreadUseCase } from '../use-cases/reviews/update-comment-thread.ts';
import type { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import type { FindWorktreeByPathUseCasePort } from '../ports/at-worktree-path-use-case-port.ts';
import type { ComposeContext } from './compose-context.ts';
import type { Shared } from './compose-shared.ts';
import type { Stores } from './compose-stores.ts';

type ReviewsDependencies = {
  stores: Stores;
  shared: Shared;
  checkWorktree: CheckWorktreeUseCasePort;
  findWorktreeByPath: FindWorktreeByPathUseCasePort;
};

export function composeReviews(
  context: ComposeContext,
  dependencies: ReviewsDependencies,
) {
  const { lanes, laneKeys, events, clock, ids, logger } = context;
  const limits = context.settings.limits.reviews;
  const { stores, shared } = dependencies;
  const { readEnvironment } = shared;
  const { checkWorktree } = dependencies;
  const signatureSource = new HmacSignatureSource();
  const commentStore = stores.comments;
  const reviewStore = stores.reviews;
  const reviewedFileStore = stores.reviewedFiles;
  const reviewedLayerStore = stores.reviewedLayers;
  const { readPublishedReview } = shared;
  const resolvePublishedReview = new ResolvePublishedReviewService(
    clock,
    signatureSource,
    limits.summaryLink,
  );
  const setReviewedFiles = new SetReviewedFilesService(
    reviewedFileStore,
    clock,
    limits.reviewedFiles,
  );

  const listCommentThreads = new ListCommentThreadsUseCase(
    checkWorktree,
    new ListCommentThreadsService(commentStore),
    lanes,
    laneKeys,
  );
  const createCommentThread = new CreateCommentThreadUseCase(
    checkWorktree,
    new CreateCommentThreadService(commentStore, ids, clock, limits.comments),
    lanes,
    laneKeys,
    events,
  );
  const replyToComment = new ReplyToCommentUseCase(
    checkWorktree,
    new ReplyToCommentService(commentStore, ids, clock, limits.comments),
    lanes,
    laneKeys,
    events,
  );
  const updateCommentThread = new UpdateCommentThreadUseCase(
    checkWorktree,
    new UpdateCommentThreadService(commentStore),
    lanes,
    laneKeys,
    events,
  );
  const publishReview = new PublishReviewUseCase(
    checkWorktree,
    shared.confirmWorktree,
    shared.readReviewEvidence,
    new PublishReviewService(
      reviewStore,
      clock,
      ids,
      new RandomSecretSource(limits.summaryLink),
    ),
    readEnvironment,
    resolvePublishedReview,
    lanes,
    laneKeys,
    events,
  );
  const readPublishedReviewUseCase = new ReadPublishedReviewUseCase(
    checkWorktree,
    readPublishedReview,
    shared.readReviewEvidence,
    readEnvironment,
    resolvePublishedReview,
    lanes,
    laneKeys,
  );
  const refreshWorktreeReview = new RefreshWorktreeReviewUseCase(
    checkWorktree,
    readPublishedReview,
    shared.readReviewEvidence,
    shared.recordReviewActivity,
    lanes,
    laneKeys,
    events,
  );
  const listReviewedLayerPaths = shared.listReviewedLayerPaths;
  const listReviewedLayers = new ListReviewedLayersService(
    reviewStore,
    reviewedLayerStore,
  );
  const { findWorktreeByPath } = dependencies;

  return {
    publishReviewAtPath: new AtWorktreePathUseCase<typeof publishReview>(
      findWorktreeByPath,
      publishReview,
    ),
    readPublishedReviewAtPath: new AtWorktreePathUseCase<
      typeof readPublishedReviewUseCase
    >(findWorktreeByPath, readPublishedReviewUseCase),
    listCommentThreadsAtPath: new AtWorktreePathUseCase<
      typeof listCommentThreads
    >(findWorktreeByPath, listCommentThreads),
    createCommentThreadAtPath: new AtWorktreePathUseCase<
      typeof createCommentThread
    >(findWorktreeByPath, createCommentThread),
    replyToCommentAtPath: new AtWorktreePathUseCase<typeof replyToComment>(
      findWorktreeByPath,
      replyToComment,
    ),
    updateCommentThreadAtPath: new AtWorktreePathUseCase<
      typeof updateCommentThread
    >(findWorktreeByPath, updateCommentThread),
    refreshReviewActivity: new RefreshReviewActivityUseCase(
      shared.listRegisteredProjects,
      shared.listKnownWorktrees,
      refreshWorktreeReview,
      lanes,
      laneKeys,
      logger,
    ),
    refreshWorktreeReview,
    invalidateReviewedMarks: new InvalidateReviewedMarksUseCase(
      checkWorktree,
      shared.invalidateReviewedMarks,
      lanes,
      laneKeys,
      events,
    ),
    listCommentThreads,
    createCommentThread,
    replyToComment,
    updateCommentThread,
    markCommentsSeen: new MarkCommentsSeenUseCase(
      checkWorktree,
      new MarkCommentsSeenService(stores.commentsSeen, commentStore),
      lanes,
      laneKeys,
      events,
    ),
    publishReview,
    readPublishedReview: readPublishedReviewUseCase,
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
    setReviewedFiles: new SetReviewedFilesUseCase(
      checkWorktree,
      shared.confirmWorktree,
      shared.readWorktreeStatus,
      shared.readChangeFingerprints,
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
      listReviewedLayerPaths,
      shared.readTextFiles,
      listReviewedLayers,
      lanes,
      laneKeys,
    ),
    setReviewedLayer: new SetReviewedLayerUseCase(
      checkWorktree,
      shared.confirmWorktree,
      new ReadReviewLayerService(reviewStore),
      shared.readTextFiles,
      new SetReviewedLayerService(reviewedLayerStore, clock),
      listReviewedLayerPaths,
      listReviewedLayers,
      lanes,
      laneKeys,
      events,
    ),
    removeReviewedLayer: new RemoveReviewedLayerUseCase(
      checkWorktree,
      new RemoveReviewedLayerService(reviewedLayerStore),
      listReviewedLayerPaths,
      shared.readTextFiles,
      listReviewedLayers,
      lanes,
      laneKeys,
      events,
    ),
  };
}
