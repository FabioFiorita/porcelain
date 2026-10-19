import {
  ReadReviewService,
  ReadReviewRevisionService,
  ListProjectReviewsService,
  SetReviewSeenService,
  SetReviewStateService,
  ListReviewMarksService,
  SetReviewMarkService,
  RemoveReviewMarkService,
  ReadReviewFileService,
  BuildReviewLinksService,
  ValidateReviewPublicationService,
} from '@porcelain/reviews/services';
import { AtReviewScopeUseCase } from '../use-cases/reviews/at-review-scope.ts';
import { remoteReviewLinkSourceLayer } from '../adapters/reviews/remote-review-link-source.ts';
import { ReadRetainedBranchDiffsService } from '@porcelain/changes/services';
import { RemoveReviewMarkUseCase } from '../use-cases/reviews/remove-review-mark.ts';
import { SetReviewMarkUseCase } from '../use-cases/reviews/set-review-mark.ts';
import { ListReviewMarksUseCase } from '../use-cases/reviews/list-review-marks.ts';
import { ReadReviewDiffsUseCase } from '../use-cases/reviews/read-review-diffs.ts';
import { ReadReviewFileUseCase } from '../use-cases/reviews/read-review-file.ts';
import { SetReviewStateUseCase } from '../use-cases/reviews/set-review-state.ts';
import { SetReviewSeenUseCase } from '../use-cases/reviews/set-review-seen.ts';
import { ListProjectReviewsUseCase } from '../use-cases/reviews/list-project-reviews.ts';
import { ReadReviewUseCase } from '../use-cases/reviews/read-review.ts';
import { gitReviewCodeReaderLayer } from '../adapters/reviews/git-review-code-reader.ts';
import { ReviewLinkOptions } from '../ports/review-link-options.ts';
import {
  RemoteAccessStore,
  NetworkAddressReader,
} from '@porcelain/access/ports';
import { BranchRangeReader } from '@porcelain/changes/ports';
import { ReadRepositoryOriginService } from '@porcelain/projects/services';
import { gitProjectRepositoryReaderLayer } from '../adapters/projects/git-project-repository-reader.ts';
import { gitReviewCommitPinnerLayer } from '../adapters/reviews/git-review-commit-pinner.ts';
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
  ResolvePublishedReviewOptions,
  ReviewedFileStore,
  SetReviewedFilesOptions,
  CommentStore,
  CreateCommentThreadOptions,
  ReplyToCommentOptions,
  BranchReviewReader,
  ReviewStore,
  ProofLimits,
  ReviewedLayerStore,
  EditCommentMessageOptions,
  CommentSeenStore,
  ReadProofFileOptions,
} from '@porcelain/reviews/ports';
import { IdSource } from '@porcelain/kernel/ports';
import { Effect, Layer, Clock } from 'effect';
import { summaryRoutes } from '../http/routes/reviews/summary-api.ts';
import { reviewsRoutes } from '../http/routes/reviews/reviews-api.ts';
import { WorktreeAccess } from '../runtime/worktree-access.ts';
import {
  ValidateReviewDraftService,
  CreateCommentThreadService,
  DeleteCommentMessageService,
  DeleteReviewService,
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
} from '@porcelain/reviews/services';
import { hmacSignatureSourceLayer } from '../adapters/reviews/hmac-signature-source.ts';
import { randomSecretSourceLayer } from '../adapters/runtime/random-secret-source.ts';
import { AtWorktreePathUseCase } from '../use-cases/reviews/at-worktree-path.ts';
import { CreateCommentThreadUseCase } from '../use-cases/reviews/create-comment-thread.ts';
import { DeleteCommentMessageUseCase } from '../use-cases/reviews/delete-comment-message.ts';
import { DeleteReviewUseCase } from '../use-cases/reviews/delete-review.ts';
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
  networkAddressReader: NetworkAddressReader;
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
  const commentStore = stores.comments;
  const reviewStore = stores.reviews;
  const reviewedFileStore = stores.reviewedFiles;
  const reviewedLayerStore = stores.reviewedLayers;
  const { readPublishedReview } = shared;
  const { findWorktreeByPath } = dependencies;
  const originLayer = ReadRepositoryOriginService.layer.pipe(
    Layer.provide(gitProjectRepositoryReaderLayer(context.settings.limits.git)),
  );
  const ports = Layer.mergeAll(
    gitReviewCodeReaderLayer(context.settings.limits),
    originLayer,
    gitReviewCommitPinnerLayer(context.settings.limits.git),
    Layer.succeed(BranchReviewReader, shared.branchReviewReader),
    Layer.succeed(BranchRangeReader, shared.branchRangeReader),
    Layer.succeed(RemoteAccessStore, stores.remoteAccess),
    Layer.succeed(NetworkAddressReader, dependencies.networkAddressReader),
    Layer.succeed(ReviewLinkOptions, {
      hubOrigin: context.settings.reviewHubOrigin,
      localHost: context.settings.host,
      localPort: context.settings.port,
    }),
    Layer.succeed(CheckWorktreeUseCasePort, checkWorktree),
    Layer.succeed(WorktreeConsistencyProbe, shared.confirmWorktree),
    Layer.succeed(Lanes, lanes),
    Layer.succeed(LaneKeys, laneKeys),
    Layer.succeed(Clock.Clock, clock),
    hmacSignatureSourceLayer,
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
    randomSecretSourceLayer(limits.summaryLink),
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
    Layer.succeed(ReadTextFilesService, shared.readTextFilesService),
  );
  const linkPorts = remoteReviewLinkSourceLayer.pipe(Layer.provideMerge(ports));
  const services = Layer.mergeAll(
    AtReviewScopeUseCase.layer,
    ReadRetainedBranchDiffsService.layer,
    ReadReviewService.layer,
    ReadReviewRevisionService.layer,
    ListProjectReviewsService.layer,
    SetReviewSeenService.layer,
    SetReviewStateService.layer,
    ListReviewMarksService.layer,
    SetReviewMarkService.layer,
    RemoveReviewMarkService.layer,
    ReadReviewFileService.layer,
    BuildReviewLinksService.layer,
    ValidateReviewPublicationService.layer,

    WorktreeAccess.layer,
    ResolvePublishedReviewService.layer,
    SetReviewedFilesService.layer,
    ListCommentThreadsService.layer,
    CreateCommentThreadService.layer,
    ReplyToCommentService.layer,
    UpdateCommentThreadService.layer,
    ValidateReviewDraftService.layer,
    PublishReviewService.layer,
    ListReviewedLayersService.layer,
    AtWorktreePathUseCase.layer,
    EditCommentMessageService.layer,
    DeleteCommentMessageService.layer,
    DeleteReviewService.layer,
    DeleteResolvedCommentsService.layer,
    MarkCommentsSeenService.layer,
    ReadProofFileService.layer,
    ReadReviewSummaryService.layer,
    ListReviewedFilesService.layer,
    RemoveReviewedFilesService.layer,
    ReadReviewLayerService.layer,
    SetReviewedLayerService.layer,
    RemoveReviewedLayerService.layer,
  ).pipe(Layer.provideMerge(linkPorts));
  const operations = Layer.mergeAll(
    RemoveReviewMarkUseCase.layer,
    SetReviewMarkUseCase.layer,
    ListReviewMarksUseCase.layer,
    ReadReviewDiffsUseCase.layer,
    ReadReviewFileUseCase.layer,
    SetReviewStateUseCase.layer,
    SetReviewSeenUseCase.layer,
    ListProjectReviewsUseCase.layer,
    ReadReviewUseCase.layer,
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
    DeleteReviewUseCase.layer,
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
    const runtime = yield* Layer.build(application);
    return yield* Effect.gen(function* () {
      const useCases = {
        atReviewScope: yield* AtReviewScopeUseCase,
        removeReviewMark: yield* RemoveReviewMarkUseCase,
        setReviewMark: yield* SetReviewMarkUseCase,
        listReviewMarks: yield* ListReviewMarksUseCase,
        readReviewDiffs: yield* ReadReviewDiffsUseCase,
        readReviewFile: yield* ReadReviewFileUseCase,
        setReviewState: yield* SetReviewStateUseCase,
        setReviewSeen: yield* SetReviewSeenUseCase,
        listProjectReviews: yield* ListProjectReviewsUseCase,
        readReview: yield* ReadReviewUseCase,
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
        deleteReview: yield* DeleteReviewUseCase,
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
    }).pipe(Effect.provideContext(runtime));
  });
}
