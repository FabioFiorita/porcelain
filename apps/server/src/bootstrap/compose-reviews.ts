import { summaryRoutes } from '../http/routes/reviews/summary-api.ts';
import { reviewsRoutes } from '../http/routes/reviews/reviews-api.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import {
  ValidateReviewDraftService,
  CheckReviewDraftService,
  CreateCommentThreadService,
  DeleteCommentMessageService,
  DeleteResolvedCommentsService,
  EditCommentMessageService,
  ResolvePublishedReviewService,
  ListCommentThreadsService,
  ListReviewedFilesService,
  ListReviewedLayersService,
  MarkCommentsSeenService,
  PublishReviewService,
  ReadProofFileService,
  ReadReviewLayerService,
  ReadReviewSummaryService,
  RemoveReviewedFilesService,
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
import { DeleteCommentMessageUseCase } from '../use-cases/reviews/delete-comment-message.ts';
import { DeleteResolvedCommentsUseCase } from '../use-cases/reviews/delete-resolved-comments.ts';
import { EditCommentMessageUseCase } from '../use-cases/reviews/edit-comment-message.ts';
import { InvalidateReviewedMarksUseCase } from '../use-cases/reviews/invalidate-reviewed-marks.ts';
import { ListCommentThreadsUseCase } from '../use-cases/reviews/list-comment-threads.ts';
import { ListReviewedFilesUseCase } from '../use-cases/reviews/list-reviewed-files.ts';
import { ListReviewedLayersUseCase } from '../use-cases/reviews/list-reviewed-layers.ts';
import { MarkCommentsSeenUseCase } from '../use-cases/reviews/mark-comments-seen.ts';
import { PublishReviewUseCase } from '../use-cases/reviews/publish-review.ts';
import { ReadProofFileUseCase } from '../use-cases/reviews/read-proof-file.ts';
import { ReadPublishedReviewUseCase } from '../use-cases/reviews/read-published-review.ts';
import { ReadReviewSummaryUseCase } from '../use-cases/reviews/read-review-summary.ts';
import { RemoveReviewedFilesUseCase } from '../use-cases/reviews/remove-reviewed-files.ts';
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
  const access = new WorktreeAccess(
    checkWorktree,
    shared.confirmWorktree,
    lanes,
    laneKeys,
  );
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
    access,
    new ListCommentThreadsService(commentStore),
  );
  const createCommentThread = new CreateCommentThreadUseCase(
    access,
    new CreateCommentThreadService(commentStore, ids, clock, limits.comments),
    events,
  );
  const replyToComment = new ReplyToCommentUseCase(
    access,
    new ReplyToCommentService(commentStore, ids, clock, limits.comments),
    events,
  );
  const updateCommentThread = new UpdateCommentThreadUseCase(
    access,
    new UpdateCommentThreadService(commentStore),
    events,
  );
  const publishReview = new PublishReviewUseCase(
    access,
    new ValidateReviewDraftService(),
    new CheckReviewDraftService(reviewStore),
    shared.readReviewEvidence,
    shared.readBinaryFiles,
    new PublishReviewService(
      reviewStore,
      clock,
      ids,
      new RandomSecretSource(limits.summaryLink),
      limits.proof,
    ),
    readEnvironment,
    resolvePublishedReview,
    events,
  );
  const readPublishedReviewUseCase = new ReadPublishedReviewUseCase(
    access,
    readPublishedReview,
    shared.readReviewEvidence,
    readEnvironment,
    resolvePublishedReview,
  );
  const refreshWorktreeReview = new RefreshWorktreeReviewUseCase(
    access,
    readPublishedReview,
    shared.readReviewEvidence,
    shared.recordReviewActivity,
    events,
  );
  const listReviewedLayerPaths = shared.listReviewedLayerPaths;
  const listReviewedLayers = new ListReviewedLayersService(
    reviewStore,
    reviewedLayerStore,
  );
  const { findWorktreeByPath } = dependencies;

  const useCases = {
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
      access,
      shared.invalidateReviewedMarks,
      events,
    ),
    listCommentThreads,
    createCommentThread,
    replyToComment,
    updateCommentThread,
    editCommentMessage: new EditCommentMessageUseCase(
      access,
      new EditCommentMessageService(commentStore, clock, limits.comments),
      events,
    ),
    deleteCommentMessage: new DeleteCommentMessageUseCase(
      access,
      new DeleteCommentMessageService(commentStore),
      events,
    ),
    deleteResolvedComments: new DeleteResolvedCommentsUseCase(
      access,
      new DeleteResolvedCommentsService(commentStore),
      events,
    ),
    markCommentsSeen: new MarkCommentsSeenUseCase(
      access,
      new MarkCommentsSeenService(stores.commentsSeen, commentStore),
      events,
    ),
    publishReview,
    readPublishedReview: readPublishedReviewUseCase,
    readProofFile: new ReadProofFileUseCase(
      access,
      new ReadProofFileService(reviewStore, limits.proof),
    ),
    readReviewSummary: new ReadReviewSummaryUseCase(
      new ReadReviewSummaryService(reviewStore, clock, signatureSource),
      lanes,
    ),
    listReviewedFiles: new ListReviewedFilesUseCase(
      access,
      new ListReviewedFilesService(reviewedFileStore),
    ),
    setReviewedFiles: new SetReviewedFilesUseCase(
      access,
      shared.readWorktreeStatus,
      shared.readChangeFingerprints,
      shared.readBranchChanges,
      setReviewedFiles,
      events,
    ),
    removeReviewedFiles: new RemoveReviewedFilesUseCase(
      access,
      new RemoveReviewedFilesService(reviewedFileStore),
      events,
    ),
    listReviewedLayers: new ListReviewedLayersUseCase(
      access,
      listReviewedLayerPaths,
      shared.readTextFilesService,
      listReviewedLayers,
    ),
    setReviewedLayer: new SetReviewedLayerUseCase(
      access,
      new ReadReviewLayerService(reviewStore),
      shared.readTextFilesService,
      new SetReviewedLayerService(reviewedLayerStore, clock),
      listReviewedLayerPaths,
      listReviewedLayers,
      events,
    ),
    removeReviewedLayer: new RemoveReviewedLayerUseCase(
      access,
      new RemoveReviewedLayerService(reviewedLayerStore),
      listReviewedLayerPaths,
      shared.readTextFilesService,
      listReviewedLayers,
      events,
    ),
  };
  return {
    ...useCases,
    routes: reviewsRoutes(useCases, context.settings.limits.http),
    summaryRoutes: summaryRoutes(useCases.readReviewSummary),
  };
}
