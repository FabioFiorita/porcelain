import { ReviewsApi } from '@porcelain/contracts/reviews';
import { RequestCaller } from '@porcelain/contracts/shared';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
import type { CreateCommentThreadUseCase } from '../../../use-cases/reviews/create-comment-thread.ts';
import type { DeleteCommentMessageUseCase } from '../../../use-cases/reviews/delete-comment-message.ts';
import type { DeleteResolvedCommentsUseCase } from '../../../use-cases/reviews/delete-resolved-comments.ts';
import type { EditCommentMessageUseCase } from '../../../use-cases/reviews/edit-comment-message.ts';
import type { ListCommentThreadsUseCase } from '../../../use-cases/reviews/list-comment-threads.ts';
import type { ListReviewedFilesUseCase } from '../../../use-cases/reviews/list-reviewed-files.ts';
import type { ListReviewedLayersUseCase } from '../../../use-cases/reviews/list-reviewed-layers.ts';
import type { MarkCommentsSeenUseCase } from '../../../use-cases/reviews/mark-comments-seen.ts';
import type { PublishReviewUseCase } from '../../../use-cases/reviews/publish-review.ts';
import type { ReadProofFileUseCase } from '../../../use-cases/reviews/read-proof-file.ts';
import type { ReadPublishedReviewUseCase } from '../../../use-cases/reviews/read-published-review.ts';
import type { RemoveReviewedFilesUseCase } from '../../../use-cases/reviews/remove-reviewed-files.ts';
import type { RemoveReviewedLayerUseCase } from '../../../use-cases/reviews/remove-reviewed-layer.ts';
import type { ReplyToCommentUseCase } from '../../../use-cases/reviews/reply-to-comment.ts';
import type { SetReviewedFilesUseCase } from '../../../use-cases/reviews/set-reviewed-files.ts';
import type { SetReviewedLayerUseCase } from '../../../use-cases/reviews/set-reviewed-layer.ts';
import type { UpdateCommentThreadUseCase } from '../../../use-cases/reviews/update-comment-thread.ts';

type ReviewsUseCases = {
  createCommentThread: Pick<CreateCommentThreadUseCase, 'execute'>;
  deleteCommentMessage: Pick<DeleteCommentMessageUseCase, 'execute'>;
  deleteResolvedComments: Pick<DeleteResolvedCommentsUseCase, 'execute'>;
  editCommentMessage: Pick<EditCommentMessageUseCase, 'execute'>;
  listCommentThreads: Pick<ListCommentThreadsUseCase, 'execute'>;
  listReviewedFiles: Pick<ListReviewedFilesUseCase, 'execute'>;
  listReviewedLayers: Pick<ListReviewedLayersUseCase, 'execute'>;
  markCommentsSeen: Pick<MarkCommentsSeenUseCase, 'execute'>;
  publishReview: Pick<PublishReviewUseCase, 'execute'>;
  readProofFile: Pick<ReadProofFileUseCase, 'execute'>;
  readPublishedReview: Pick<ReadPublishedReviewUseCase, 'execute'>;
  removeReviewedFiles: Pick<RemoveReviewedFilesUseCase, 'execute'>;
  removeReviewedLayer: Pick<RemoveReviewedLayerUseCase, 'execute'>;
  replyToComment: Pick<ReplyToCommentUseCase, 'execute'>;
  setReviewedFiles: Pick<SetReviewedFilesUseCase, 'execute'>;
  setReviewedLayer: Pick<SetReviewedLayerUseCase, 'execute'>;
  updateCommentThread: Pick<UpdateCommentThreadUseCase, 'execute'>;
};

export function reviewsRoutes(
  useCases: ReviewsUseCases,
  limits: { reviewBodyBytes: number },
) {
  const handlers = HttpApiBuilder.group(ReviewsApi, 'reviews', (handlers) =>
    handlers
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
      .handle('publishReview', ({ params, payload }) =>
        useCases.publishReview
          .execute({ ...params, ...payload })
          .pipe(Effect.map(({ review }) => ({ review }))),
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
  return effectRoutes(
    ReviewsApi,
    HttpApiBuilder.layer(ReviewsApi).pipe(Layer.provide(handlers)),
    { publishReview: limits.reviewBodyBytes },
  );
}
