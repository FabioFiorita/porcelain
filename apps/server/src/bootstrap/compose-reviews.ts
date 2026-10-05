import { FindWorktreeByPathUseCasePort } from '../ports/at-worktree-path-use-case-port.ts';
import {
  ReadWorktreeStatusService,
  ReadChangeFingerprintsService,
  ReadBranchChangesService,
} from '@porcelain/changes/services';
import { Logger } from '../ports/logger.ts';
import { RefreshWorktreeReviewUseCasePort } from '../ports/refresh-worktree-review-use-case-port.ts';
import {
  ListRegisteredProjectsService,
  ListKnownWorktreesService,
} from '@porcelain/projects/services';
import { ReadEnvironmentService } from '@porcelain/access/services';
import {
  ReadBinaryFilesService,
  ReadTextFilesService,
} from '@porcelain/files/services';
import { ReadReviewEvidenceUseCasePort } from '../ports/read-review-evidence-use-case-port.ts';
import { EventPublisher } from '../ports/event-publisher.ts';
import { LaneKeys } from '../runtime/lane-keys.ts';
import { Lanes } from '../runtime/lanes.ts';
import { WorktreeConsistencyProbe } from '../ports/worktree-consistency-probe.ts';
import {
  SignatureSource,
  ResolvePublishedReviewOptions,
  ReviewedFileStore,
  SetReviewedFilesOptions,
  CommentStore,
  CreateCommentThreadOptions,
  ReplyToCommentOptions,
  ReviewStore,
  ProofLimits,
  ReviewedLayerStore,
  EditCommentMessageOptions,
  CommentSeenStore,
  ReadProofFileOptions,
} from '@porcelain/reviews/ports';
import { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { Effect, Layer } from 'effect';
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
  ReadPublishedReviewService,
  RecordReviewActivityService,
  InvalidateReviewedMarksService,
  ListReviewedLayerPathsService,
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
import { CheckWorktreeUseCasePort } from '../ports/check-worktree-use-case-port.ts';
import { type ComposeContext } from './compose-context.ts';
import { type Shared } from './compose-shared.ts';
import { type Stores } from './compose-stores.ts';

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
  const listReviewedLayerPaths = shared.listReviewedLayerPaths;
  const { findWorktreeByPath } = dependencies;
  const ports = Layer.mergeAll(
    Layer.succeed(CheckWorktreeUseCasePort, checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(Clock, clock),
    Layer.succeed(SignatureSource, signatureSource),
    Layer.succeed(ResolvePublishedReviewOptions, limits.summaryLink),
    Layer.succeed(ReviewedFileStore, reviewedFileStore),
    Layer.succeed(SetReviewedFilesOptions, limits.reviewedFiles),
    Layer.succeed(CommentStore, commentStore),
    Layer.succeed(IdSource, ids),
    Layer.succeed(CreateCommentThreadOptions, limits.comments),
    Layer.succeed(EventPublisher, events),
    Layer.succeed(ReplyToCommentOptions, limits.comments),
    Layer.succeed(ReviewStore, reviewStore),
    Layer.succeed(ReadReviewEvidenceUseCasePort, shared.readReviewEvidence),
    Layer.succeed(ReadBinaryFilesService, shared.readBinaryFiles),
    Layer.succeed(SecretSource, new RandomSecretSource(limits.summaryLink)),
    Layer.succeed(ProofLimits, limits.proof),
    Layer.succeed(ReadEnvironmentService, readEnvironment),
    Layer.succeed(ReadPublishedReviewService, readPublishedReview),
    Layer.succeed(RecordReviewActivityService, shared.recordReviewActivity),
    Layer.succeed(ReviewedLayerStore, reviewedLayerStore),
    Layer.succeed(FindWorktreeByPathUseCasePort, findWorktreeByPath),
    Layer.succeed(ListRegisteredProjectsService, shared.listRegisteredProjects),
    Layer.succeed(ListKnownWorktreesService, shared.listKnownWorktrees),
    Layer.succeed(Logger, logger),
    Layer.succeed(
      InvalidateReviewedMarksService,
      shared.invalidateReviewedMarks,
    ),
    Layer.succeed(EditCommentMessageOptions, limits.comments),
    Layer.succeed(CommentSeenStore, stores.commentsSeen),
    Layer.succeed(ReadProofFileOptions, limits.proof),
    Layer.succeed(ReadWorktreeStatusService, shared.readWorktreeStatus),
    Layer.succeed(ReadChangeFingerprintsService, shared.readChangeFingerprints),
    Layer.succeed(ReadBranchChangesService, shared.readBranchChanges),
    Layer.succeed(ListReviewedLayerPathsService, listReviewedLayerPaths),
    Layer.succeed(ReadTextFilesService, shared.readTextFilesService),
  );
  const services = Layer.mergeAll(
    WorktreeAccess.layer,
    ResolvePublishedReviewService.layer,
    SetReviewedFilesService.layer,
    ListCommentThreadsService.layer,
    CreateCommentThreadService.layer,
    ReplyToCommentService.layer,
    UpdateCommentThreadService.layer,
    ValidateReviewDraftService.layer,
    CheckReviewDraftService.layer,
    PublishReviewService.layer,
    ListReviewedLayersService.layer,
    AtWorktreePathUseCase.layer,
    EditCommentMessageService.layer,
    DeleteCommentMessageService.layer,
    DeleteResolvedCommentsService.layer,
    MarkCommentsSeenService.layer,
    ReadProofFileService.layer,
    ReadReviewSummaryService.layer,
    ListReviewedFilesService.layer,
    RemoveReviewedFilesService.layer,
    ReadReviewLayerService.layer,
    SetReviewedLayerService.layer,
    RemoveReviewedLayerService.layer,
  ).pipe(Layer.provideMerge(ports));
  const operations = Layer.mergeAll(
    ListCommentThreadsUseCase.layer,
    CreateCommentThreadUseCase.layer,
    ReplyToCommentUseCase.layer,
    UpdateCommentThreadUseCase.layer,
    PublishReviewUseCase.layer,
    ReadPublishedReviewUseCase.layer,
    RefreshWorktreeReviewUseCase.layer,
    InvalidateReviewedMarksUseCase.layer,
    EditCommentMessageUseCase.layer,
    DeleteCommentMessageUseCase.layer,
    DeleteResolvedCommentsUseCase.layer,
    MarkCommentsSeenUseCase.layer,
    ReadProofFileUseCase.layer,
    ReadReviewSummaryUseCase.layer,
    ListReviewedFilesUseCase.layer,
    SetReviewedFilesUseCase.layer,
    RemoveReviewedFilesUseCase.layer,
    ListReviewedLayersUseCase.layer,
    SetReviewedLayerUseCase.layer,
    RemoveReviewedLayerUseCase.layer,
  ).pipe(Layer.provideMerge(services));
  const admission = Layer.mergeAll(
    Layer.effect(
      RefreshWorktreeReviewUseCasePort,
      RefreshWorktreeReviewUseCase,
    ),
  ).pipe(Layer.provideMerge(operations));
  const application = Layer.mergeAll(RefreshReviewActivityUseCase.layer).pipe(
    Layer.provideMerge(admission),
  );
  return Effect.gen(function* () {
    const useCases = {
      atWorktreePath: yield* AtWorktreePathUseCase,

      refreshReviewActivity: yield* RefreshReviewActivityUseCase,
      refreshWorktreeReview: yield* RefreshWorktreeReviewUseCase,
      invalidateReviewedMarks: yield* InvalidateReviewedMarksUseCase,
      listCommentThreads: yield* ListCommentThreadsUseCase,
      createCommentThread: yield* CreateCommentThreadUseCase,
      replyToComment: yield* ReplyToCommentUseCase,
      updateCommentThread: yield* UpdateCommentThreadUseCase,
      editCommentMessage: yield* EditCommentMessageUseCase,
      deleteCommentMessage: yield* DeleteCommentMessageUseCase,
      deleteResolvedComments: yield* DeleteResolvedCommentsUseCase,
      markCommentsSeen: yield* MarkCommentsSeenUseCase,
      publishReview: yield* PublishReviewUseCase,
      readPublishedReview: yield* ReadPublishedReviewUseCase,
      readProofFile: yield* ReadProofFileUseCase,
      readReviewSummary: yield* ReadReviewSummaryUseCase,
      listReviewedFiles: yield* ListReviewedFilesUseCase,
      setReviewedFiles: yield* SetReviewedFilesUseCase,
      removeReviewedFiles: yield* RemoveReviewedFilesUseCase,
      listReviewedLayers: yield* ListReviewedLayersUseCase,
      setReviewedLayer: yield* SetReviewedLayerUseCase,
      removeReviewedLayer: yield* RemoveReviewedLayerUseCase,
    };
    return {
      ...useCases,
      routes: reviewsRoutes(useCases, context.settings.limits.http),
      summaryRoutes: summaryRoutes(useCases.readReviewSummary),
    };
  }).pipe(Effect.provide(application));
}
