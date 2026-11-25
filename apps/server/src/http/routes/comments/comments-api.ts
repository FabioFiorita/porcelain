import { CommentsApi, OwnerCommentsApi } from '@porcelain/contracts/comments';
import { HttpApiBuilder } from 'effect/http-api';
import { Layer, type Context } from 'effect';
import { handlerAudit } from '../../diagnostics.ts';
import { requestBody } from '../../hooks/request-body.ts';
import type { ListCommentsUseCase } from '../../../use-cases/comments/list-comments.ts';
import type { ChangeCommentUseCase } from '../../../use-cases/comments/change-comment.ts';
import type { PreviewCommentReviewUseCase } from '../../../use-cases/comments/preview-comment-review.ts';
import type { PublishCommentReviewUseCase } from '../../../use-cases/comments/publish-comment-review.ts';
import type { ReadOwnerCommentsUseCase } from '../../../use-cases/comments/read-owner-comments.ts';

type UseCases = {
  listComments: Context.Service.Shape<typeof ListCommentsUseCase>;
  changeComment: Context.Service.Shape<typeof ChangeCommentUseCase>;
  previewReview: Context.Service.Shape<typeof PreviewCommentReviewUseCase>;
  publishReview: Context.Service.Shape<typeof PublishCommentReviewUseCase>;
  readOwnerComments: Context.Service.Shape<typeof ReadOwnerCommentsUseCase>;
};

export function commentsRoutes(useCases: UseCases) {
  const handlers = HttpApiBuilder.group(CommentsApi, 'comments', (handlers) =>
    handlers
      .handle('listComments', ({ params }) =>
        useCases.listComments.execute(params),
      )
      .handle('addComment', ({ params, payload }) =>
        useCases.changeComment.execute({ ...params, ...payload, kind: 'add' }),
      )
      .handle('editComment', ({ params, payload }) =>
        useCases.changeComment.execute({
          worktreeId: params.worktreeId,
          commentId: params.commentId,
          text: payload.text,
          kind: 'edit',
        }),
      )
      .handle('deleteComment', ({ params }) =>
        useCases.changeComment.execute({
          worktreeId: params.worktreeId,
          commentId: params.commentId,
          kind: 'delete',
        }),
      )
      .handle('previewCommentReview', ({ params }) =>
        useCases.previewReview.execute(params),
      )
      .handle('publishCommentReview', ({ params, payload }) =>
        useCases.publishReview.execute({ ...params, ...payload }),
      ),
  );
  return HttpApiBuilder.layer(CommentsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}

export function ownerCommentsRoutes(useCases: UseCases) {
  const handlers = HttpApiBuilder.group(
    OwnerCommentsApi,
    'ownerComments',
    (handlers) =>
      handlers.handle('readOwnerComments', ({ query }) =>
        useCases.readOwnerComments.execute(query),
      ),
  );
  return HttpApiBuilder.layer(OwnerCommentsApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
  );
}
