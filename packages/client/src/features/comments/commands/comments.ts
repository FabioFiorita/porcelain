import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  AddCommentRequest,
  PublishReviewRequest,
} from '@porcelain/contracts/comments';
import type { WorktreeSelection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';

export const commentCommands = Atom.family(
  ({ connection, scope }: WorktreeSelection) => {
    const runtime = clientRuntime(connection);
    const worktreeId = scope.worktreeId;
    const invalidate = Reactivity.invalidate([
      queryKeys.reviewSurface(connection.environmentId, scope, ['comments']),
    ]);
    return {
      add: runtime.fn(
        Effect.fn('Comments.add')(function* (payload: AddCommentRequest) {
          const view = yield* requestApi(connection, (api) =>
            api.comments.addComment({ params: { worktreeId }, payload }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      edit: runtime.fn(
        Effect.fn('Comments.edit')(function* (input: {
          commentId: string;
          text: string;
        }) {
          const view = yield* requestApi(connection, (api) =>
            api.comments.editComment({
              params: { worktreeId, commentId: input.commentId },
              payload: { text: input.text },
            }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      remove: runtime.fn(
        Effect.fn('Comments.remove')(function* (commentId: string) {
          const view = yield* requestApi(connection, (api) =>
            api.comments.deleteComment({ params: { worktreeId, commentId } }),
          );
          yield* invalidate;
          return view;
        }),
      ),
      preview: runtime.fn(
        Effect.fn('Comments.preview')(function* () {
          return yield* requestApi(connection, (api) =>
            api.comments.previewCommentReview({ params: { worktreeId } }),
          );
        }),
      ),
      publish: runtime.fn(
        Effect.fn('Comments.publish')(function* (
          payload: PublishReviewRequest,
        ) {
          const answer = yield* requestApi(connection, (api) =>
            api.comments.publishCommentReview({
              params: { worktreeId },
              payload,
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
    };
  },
);
