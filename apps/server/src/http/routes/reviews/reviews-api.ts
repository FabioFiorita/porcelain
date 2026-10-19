import type { CompareReviewUseCase } from '../../../use-cases/reviews/compare-review.ts';
import type { ReadReviewInterdiffUseCase } from '../../../use-cases/reviews/read-review-interdiff.ts';
import { type RemoveReviewMarkUseCase } from '../../../use-cases/reviews/remove-review-mark.ts';
import { type SetReviewMarkUseCase } from '../../../use-cases/reviews/set-review-mark.ts';
import { type ListReviewMarksUseCase } from '../../../use-cases/reviews/list-review-marks.ts';
import { type ReadReviewDiffsUseCase } from '../../../use-cases/reviews/read-review-diffs.ts';
import { type ReadReviewFileUseCase } from '../../../use-cases/reviews/read-review-file.ts';
import { type SetReviewStateUseCase } from '../../../use-cases/reviews/set-review-state.ts';
import { type SetReviewSeenUseCase } from '../../../use-cases/reviews/set-review-seen.ts';
import { type ListProjectReviewsUseCase } from '../../../use-cases/reviews/list-project-reviews.ts';
import { type ReadReviewUseCase } from '../../../use-cases/reviews/read-review.ts';
import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBodyLimit } from '../../hooks/request-body.ts';
import { ReviewsApi } from '@porcelain/contracts/reviews';
import { RequestCaller } from '@porcelain/contracts/shared';
import type { Context } from 'effect';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { type CreateCommentThreadUseCase } from '../../../use-cases/reviews/create-comment-thread.ts';
import { type DeleteCommentMessageUseCase } from '../../../use-cases/reviews/delete-comment-message.ts';
import { type DeleteReviewUseCase } from '../../../use-cases/reviews/delete-review.ts';
import { type DeleteResolvedCommentsUseCase } from '../../../use-cases/reviews/delete-resolved-comments.ts';
import { type EditCommentMessageUseCase } from '../../../use-cases/reviews/edit-comment-message.ts';
import { type ListCommentThreadsUseCase } from '../../../use-cases/reviews/list-comment-threads.ts';
import { type ListReviewedFilesUseCase } from '../../../use-cases/reviews/list-reviewed-files.ts';
import { type ListReviewedLayersUseCase } from '../../../use-cases/reviews/list-reviewed-layers.ts';
import { type MarkCommentsSeenUseCase } from '../../../use-cases/reviews/mark-comments-seen.ts';
import { type PublishReviewUseCase } from '../../../use-cases/reviews/publish-review.ts';
import { type ReadProofFileUseCase } from '../../../use-cases/reviews/read-proof-file.ts';
import { type ReadPublishedReviewUseCase } from '../../../use-cases/reviews/read-published-review.ts';
import { type RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';
import { type RemoveReviewedLayerUseCase } from '../../../use-cases/reviews/remove-reviewed-layer.ts';
import { type ReplyToCommentUseCase } from '../../../use-cases/reviews/reply-to-comment.ts';
import { type SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';
import { type SetReviewedLayerUseCase } from '../../../use-cases/reviews/set-reviewed-layer.ts';
import { type UpdateCommentThreadUseCase } from '../../../use-cases/reviews/update-comment-thread.ts';

type ReviewsUseCases = {
  compareReview: Pick<
    Context.Service.Shape<typeof CompareReviewUseCase>,
    'execute'
  >;
  readReviewInterdiff: Pick<
    Context.Service.Shape<typeof ReadReviewInterdiffUseCase>,
    'execute'
  >;
  removeReviewMark: Context.Service.Shape<typeof RemoveReviewMarkUseCase>;
  setReviewMark: Context.Service.Shape<typeof SetReviewMarkUseCase>;
  listReviewMarks: Context.Service.Shape<typeof ListReviewMarksUseCase>;
  readReviewDiffs: Context.Service.Shape<typeof ReadReviewDiffsUseCase>;
  readReviewFile: Context.Service.Shape<typeof ReadReviewFileUseCase>;
  setReviewState: Context.Service.Shape<typeof SetReviewStateUseCase>;
  setReviewSeen: Context.Service.Shape<typeof SetReviewSeenUseCase>;
  listProjectReviews: Context.Service.Shape<typeof ListProjectReviewsUseCase>;
  readReview: Context.Service.Shape<typeof ReadReviewUseCase>;
  deleteReview: Context.Service.Shape<typeof DeleteReviewUseCase>;
  createCommentThread: Pick<
    Context.Service.Shape<typeof CreateCommentThreadUseCase>,
    'execute'
  >;
  deleteCommentMessage: Pick<
    Context.Service.Shape<typeof DeleteCommentMessageUseCase>,
    'execute'
  >;
  deleteResolvedComments: Pick<
    Context.Service.Shape<typeof DeleteResolvedCommentsUseCase>,
    'execute'
  >;
  editCommentMessage: Pick<
    Context.Service.Shape<typeof EditCommentMessageUseCase>,
    'execute'
  >;
  listCommentThreads: Pick<
    Context.Service.Shape<typeof ListCommentThreadsUseCase>,
    'execute'
  >;
  listReviewedFiles: Pick<
    Context.Service.Shape<typeof ListReviewedFilesUseCase>,
    'execute'
  >;
  listReviewedLayers: Pick<
    Context.Service.Shape<typeof ListReviewedLayersUseCase>,
    'execute'
  >;
  markCommentsSeen: Pick<
    Context.Service.Shape<typeof MarkCommentsSeenUseCase>,
    'execute'
  >;
  publishReview: Pick<
    Context.Service.Shape<typeof PublishReviewUseCase>,
    'execute'
  >;
  readProofFile: Pick<
    Context.Service.Shape<typeof ReadProofFileUseCase>,
    'execute'
  >;
  readPublishedReview: Pick<
    Context.Service.Shape<typeof ReadPublishedReviewUseCase>,
    'execute'
  >;
  removeReviewedFiles: Pick<
    Context.Service.Shape<typeof RemoveReviewedFilesUseCase>,
    'execute'
  >;
  removeReviewedLayer: Pick<
    Context.Service.Shape<typeof RemoveReviewedLayerUseCase>,
    'execute'
  >;
  replyToComment: Pick<
    Context.Service.Shape<typeof ReplyToCommentUseCase>,
    'execute'
  >;
  setReviewedFiles: Pick<
    Context.Service.Shape<typeof SetReviewedFilesUseCase>,
    'execute'
  >;
  setReviewedLayer: Pick<
    Context.Service.Shape<typeof SetReviewedLayerUseCase>,
    'execute'
  >;
  updateCommentThread: Pick<
    Context.Service.Shape<typeof UpdateCommentThreadUseCase>,
    'execute'
  >;
};

export function reviewsRoutes(
  useCases: ReviewsUseCases,
  limits: { reviewBodyBytes: number },
) {
  const handlers = HttpApiBuilder.group(ReviewsApi, 'reviews', (handlers) =>
    handlers
      .handle('compareReview', ({ params, query }) =>
        useCases.compareReview.execute({ ...params, ...query }),
      )
      .handle('readReviewInterdiff', ({ params, query }) =>
        useCases.readReviewInterdiff.execute({ ...params, ...query }),
      )
      .handle('deleteReviewCommentMessage', ({ params, query }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.deleteCommentMessage.execute({
            ...query,
            ...params,
            writer,
          }),
        ),
      )
      .handle('deleteResolvedReviewComments', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.deleteResolvedComments.execute({
            ...payload,
            ...params,
            writer,
          }),
        ),
      )
      .handle('editReviewCommentMessage', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.editCommentMessage.execute({
            ...payload,
            ...params,
            writer,
          }),
        ),
      )
      .handle('listReviewMarks', ({ params }) =>
        useCases.listReviewMarks.execute(params),
      )
      .handle('setReviewMark', ({ params, payload }) =>
        useCases.setReviewMark.execute({ ...payload, ...params }),
      )
      .handle('removeReviewMark', ({ params, payload }) =>
        useCases.removeReviewMark.execute({ ...payload, ...params }),
      )
      .handle('createReviewCommentThread', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.createCommentThread.execute({
            ...payload,
            ...params,
            writer,
          }),
        ),
      )
      .handle('listReviewCommentThreads', ({ params }) =>
        useCases.listCommentThreads.execute(params),
      )
      .handle('replyToReviewComment', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.replyToComment.execute({ ...payload, ...params, writer }),
        ),
      )
      .handle('updateReviewCommentThread', ({ params, payload }) =>
        useCases.updateCommentThread.execute({ ...payload, ...params }),
      )
      .handle('readReview', ({ params }) => useCases.readReview.execute(params))
      .handle('readReviewRevision', ({ params }) =>
        useCases.readReview.execute(params),
      )
      .handle('listProjectReviews', ({ params }) =>
        useCases.listProjectReviews.execute(params),
      )
      .handle('setReviewSeen', ({ params, payload }) =>
        useCases.setReviewSeen.execute({ ...params, ...payload }),
      )
      .handle('setReviewState', ({ params, payload }) =>
        useCases.setReviewState.execute({ ...params, ...payload }),
      )
      .handle('deleteProjectReview', ({ params }) =>
        useCases.deleteReview.execute(params),
      )
      .handle('readReviewProofFile', ({ params, query }) =>
        useCases.readProofFile.execute({ ...params, ...query }),
      )
      .handle('readReviewFile', ({ params, query }) =>
        useCases.readReviewFile.execute({ ...params, ...query }),
      )
      .handle('readReviewDiffs', ({ params, payload }) =>
        useCases.readReviewDiffs.execute({ ...params, ...payload }),
      )
      .handle('createCommentThread', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.createCommentThread.execute({
            ...params,
            ...payload,
            writer,
          }),
        ),
      )
      .handle('deleteCommentMessage', ({ params, query }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.deleteCommentMessage.execute({
            ...params,
            ...query,
            writer,
          }),
        ),
      )
      .handle('deleteResolvedComments', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.deleteResolvedComments.execute({
            ...params,
            ...payload,
            writer,
          }),
        ),
      )
      .handle('editCommentMessage', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.editCommentMessage.execute({
            ...params,
            ...payload,
            writer,
          }),
        ),
      )
      .handle('listCommentThreads', ({ params }) =>
        useCases.listCommentThreads.execute(params),
      )
      .handle('listReviewedFiles', ({ params, query }) =>
        useCases.listReviewedFiles.execute({ ...params, ...query }),
      )
      .handle('listReviewedLayers', ({ params }) =>
        useCases.listReviewedLayers.execute(params),
      )
      .handle('markCommentsSeen', ({ params, payload }) =>
        useCases.markCommentsSeen.execute({ ...params, ...payload }),
      )
      .handle('deleteReview', ({ params }) =>
        useCases.deleteReview.execute(params),
      )
      .handle('publishReview', ({ params, payload }) =>
        useCases.publishReview.execute({ ...params, ...payload }),
      )
      .handle('readProofFile', ({ params, query }) =>
        useCases.readProofFile.execute({ ...params, ...query }),
      )
      .handle('readPublishedReview', ({ params }) =>
        useCases.readPublishedReview.execute(params),
      )
      .handle('removeReviewedFile', ({ params, query }) =>
        useCases.removeReviewedFiles.execute({ ...params, ...query }),
      )
      .handle('removeReviewedFiles', ({ params, payload }) =>
        useCases.removeReviewedFiles.execute({ ...params, ...payload }),
      )
      .handle('removeReviewedLayer', ({ params, query }) =>
        useCases.removeReviewedLayer.execute({ ...params, ...query }),
      )
      .handle('replyToComment', ({ params, payload }) =>
        Effect.flatMap(RequestCaller, (writer) =>
          useCases.replyToComment.execute({ ...params, ...payload, writer }),
        ),
      )
      .handle('setReviewedFile', ({ params, payload }) =>
        useCases.setReviewedFiles.execute({
          ...params,
          ...payload,
          onConflict: 'refuse',
        }),
      )
      .handle('setReviewedFiles', ({ params, payload }) =>
        useCases.setReviewedFiles.execute({
          ...params,
          ...payload,
          onConflict: 'report',
        }),
      )
      .handle('setReviewedLayer', ({ params, payload }) =>
        useCases.setReviewedLayer.execute({ ...params, ...payload }),
      )
      .handle('updateCommentThread', ({ params, payload }) =>
        useCases.updateCommentThread.execute({ ...params, ...payload }),
      ),
  );
  return HttpApiBuilder.layer(ReviewsApi)
    .pipe(
      Layer.provide(handlers),
      Layer.provide(handlerAudit.layer),
      Layer.provide(requestBody.layer),
    )
    .pipe(
      Layer.provide(
        requestBodyLimit(
          ReviewsApi.groups.reviews.endpoints.publishReview,
          limits.reviewBodyBytes,
        ),
      ),
    );
}
