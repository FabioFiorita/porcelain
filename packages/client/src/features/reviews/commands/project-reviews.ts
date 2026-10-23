import { queryKeys } from '../../../shared/api/query-keys.ts';
import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  ArchiveReviewRequest,
  SetReviewMarkRequest,
  RemoveReviewMarkRequest,
  CreateCommentThreadRequest,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
  EditCommentMessageRequest,
  DeleteResolvedCommentsRequest,
} from '@porcelain/contracts/reviews';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { requestApi } from '../../../shared/api/client.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

export const reviewCommands = Atom.family(
  (input: { connection: RuntimeConnection; reviewId: string }) => {
    const runtime = clientRuntime(input.connection);
    const params = { reviewId: input.reviewId };
    const invalidate = Reactivity.invalidate([
      queryKeys.projectReviews(input.connection.environmentId),
      queryKeys.durableReview(input.connection.environmentId, input.reviewId),
    ]);
    return {
      archive: runtime.fn(
        Effect.fn('Reviews.archive')(function* (payload: ArchiveReviewRequest) {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.archiveReview({ params, payload }),
          );
          if (answer.archived) yield* invalidate;
          return answer;
        }),
      ),
      createComment: runtime.fn(
        Effect.fn('Reviews.createComment')(function* (
          payload: CreateCommentThreadRequest,
        ) {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.createReviewCommentThread({ params, payload }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      reply: runtime.fn(
        Effect.fn('Reviews.reply')(function* (
          payload: ReplyToCommentRequest & { threadId: string },
        ) {
          const { threadId, ...body } = payload;
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.replyToReviewComment({
              params: { ...params, threadId },
              payload: body,
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      resolve: runtime.fn(
        Effect.fn('Reviews.resolve')(function* (
          payload: UpdateCommentThreadRequest & { threadId: string },
        ) {
          const { threadId, ...body } = payload;
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.updateReviewCommentThread({
              params: { ...params, threadId },
              payload: body,
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      edit: runtime.fn(
        Effect.fn('Reviews.edit')(function* (
          payload: EditCommentMessageRequest & { threadId: string },
        ) {
          const { threadId, ...body } = payload;
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.editReviewCommentMessage({
              params: { ...params, threadId },
              payload: body,
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      deleteComment: runtime.fn(
        Effect.fn('Reviews.deleteComment')(function* (target: {
          threadId: string;
          messageId: string;
        }) {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.deleteReviewCommentMessage({
              params: { ...params, threadId: target.threadId },
              query: { messageId: target.messageId },
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      deleteResolved: runtime.fn(
        Effect.fn('Reviews.deleteResolved')(function* (
          threads: DeleteResolvedCommentsRequest['threads'],
        ) {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.deleteResolvedReviewComments({
              params,
              payload: { threads },
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      seen: runtime.fn(
        Effect.fn('Reviews.seen')(function* (revision: number) {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.setReviewSeen({ params, payload: { revision } }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      close: runtime.fn(
        Effect.fn('Reviews.close')(function* () {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.setReviewState({
              params,
              payload: { state: 'closed' },
            }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      remove: runtime.fn(
        Effect.fn('Reviews.remove')(function* () {
          const answer = yield* requestApi(input.connection, (api) =>
            api.reviews.deleteProjectReview({ params }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      completeDecision: runtime.fn(
        Effect.fn('Reviews.completeDecision')(function* (payload: {
          revision: number;
          layerId: string;
          fingerprint: string;
          files: readonly { path: string; headBlobOid: string }[];
        }) {
          return yield* Effect.gen(function* () {
            for (const file of payload.files)
              yield* requestApi(input.connection, (api) =>
                api.reviews.setReviewMark({
                  params,
                  payload: {
                    kind: 'file',
                    revision: payload.revision,
                    ...file,
                  },
                }),
              );
            return yield* requestApi(input.connection, (api) =>
              api.reviews.setReviewMark({
                params,
                payload: {
                  kind: 'decision',
                  revision: payload.revision,
                  layerId: payload.layerId,
                  fingerprint: payload.fingerprint,
                },
              }),
            );
          }).pipe(Effect.ensuring(invalidate));
        }),
      ),
      markFiles: runtime.fn(
        Effect.fn('Reviews.markFiles')(function* (payload: {
          revision: number;
          files: readonly { path: string; headBlobOid: string }[];
        }) {
          return yield* Effect.forEach(
            payload.files,
            (file) =>
              requestApi(input.connection, (api) =>
                api.reviews.setReviewMark({
                  params,
                  payload: {
                    kind: 'file',
                    revision: payload.revision,
                    ...file,
                  },
                }),
              ),
            { discard: true },
          ).pipe(Effect.ensuring(invalidate));
        }),
      ),
      mark: runtime.fn(
        Effect.fn('Reviews.mark')(function* (payload: SetReviewMarkRequest) {
          const answer = yield* requestApi(input.connection, (api) =>
            payload.kind === 'file'
              ? api.reviews.setReviewMark({ params, payload })
              : api.reviews.setReviewMark({ params, payload }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
      unmark: runtime.fn(
        Effect.fn('Reviews.unmark')(function* (
          payload: RemoveReviewMarkRequest,
        ) {
          const answer = yield* requestApi(input.connection, (api) =>
            payload.kind === 'file'
              ? api.reviews.removeReviewMark({ params, payload })
              : api.reviews.removeReviewMark({ params, payload }),
          );
          yield* invalidate;
          return answer;
        }),
      ),
    };
  },
);
