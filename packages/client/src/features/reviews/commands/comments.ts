import type {
  CreateCommentThreadRequest,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
  EditCommentMessageRequest,
} from '@porcelain/contracts/reviews';
import { Effect, Option } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { CommentThreadsState, commentsRuntime } from '../store/comments.ts';
import {
  mergeCommentThreads,
  type CommentThread,
  type ConfirmedThreads,
} from '../rules/comments.ts';

type ReplyCommentInput = { threadId: string } & ReplyToCommentRequest;
type ResolveCommentInput = { threadId: string } & UpdateCommentThreadRequest;
type EditCommentInput = { threadId: string } & EditCommentMessageRequest;
type DeleteCommentInput = { threadId: string; messageId: string };

export const commentCommands = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) => {
    const runtime = commentsRuntime({ connection, scope });
    const params = { worktreeId: scope.worktreeId };
    const inventory = Reactivity.invalidate([
      queryKeys.inventory(connection.environmentId),
    ]);
    function confirmThread<E>(
      operation: Effect.Effect<CommentThread, E>,
      refreshInventory = false,
    ) {
      return Effect.gen(function* () {
        const state = yield* CommentThreadsState;
        const thread = yield* state.confirm(
          operation.pipe(
            Effect.tap((thread) =>
              currentAnswerEffect(
                connection.request().signal,
                thread.worktreeId === scope.worktreeId,
              ),
            ),
          ),
          (previous, thread) =>
            Option.some(
              mergeCommentThreads(
                Option.getOrElse(previous, () => []),
                [thread],
              ),
            ),
        );
        if (refreshInventory) yield* inventory;
        return thread;
      });
    }
    return {
      create: runtime.fn(
        Effect.fn('Reviews.createComment')(function* (
          input: CreateCommentThreadRequest,
        ) {
          const api = yield* porcelainClient(connection);
          return yield* confirmThread(
            requestEffect(
              api.reviews.createCommentThread({ params, payload: input }),
            ),
          );
        }),
        { concurrent: true },
      ),
      reply: runtime.fn(
        Effect.fn('Reviews.replyToComment')(function* ({
          threadId,
          body,
          messageId,
        }: ReplyCommentInput) {
          const api = yield* porcelainClient(connection);
          return yield* confirmThread(
            requestEffect(
              api.reviews.replyToComment({
                params: { ...params, threadId },
                payload: { body, messageId },
              }),
            ),
            true,
          );
        }),
        { concurrent: true },
      ),
      resolve: runtime.fn(
        Effect.fn('Reviews.resolveComment')(function* ({
          threadId,
          resolved,
        }: ResolveCommentInput) {
          const api = yield* porcelainClient(connection);
          return yield* confirmThread(
            requestEffect(
              api.reviews.updateCommentThread({
                params: { ...params, threadId },
                payload: { resolved },
              }),
            ),
          );
        }),
        { concurrent: true },
      ),
      edit: runtime.fn(
        Effect.fn('Reviews.editComment')(function* ({
          threadId,
          messageId,
          body,
        }: EditCommentInput) {
          const api = yield* porcelainClient(connection);
          return yield* confirmThread(
            requestEffect(
              api.reviews.editCommentMessage({
                params: { ...params, threadId },
                payload: { messageId, body },
              }),
            ),
          );
        }),
        { concurrent: true },
      ),
      remove: runtime.fn(
        Effect.fn('Reviews.deleteComment')(function* ({
          threadId,
          messageId,
        }: DeleteCommentInput) {
          const api = yield* porcelainClient(connection);
          const state = yield* CommentThreadsState;
          const result = yield* state.confirm(
            Effect.gen(function* () {
              const answer = yield* requestEffect(
                api.reviews.deleteCommentMessage({
                  params: { ...params, threadId },
                  query: { messageId },
                }),
              );
              yield* currentAnswerEffect(
                connection.request().signal,
                answer.threadId === threadId &&
                  (!answer.thread ||
                    answer.thread.worktreeId === scope.worktreeId),
              );
              return answer;
            }),
            (previous, answer) =>
              Option.some(
                mergeCommentThreads(
                  Option.getOrElse(previous, () => []),
                  answer.thread ? [answer.thread] : [],
                  answer.thread ? [] : [answer.threadId],
                ),
              ),
          );
          yield* inventory;
          return result;
        }),
        { concurrent: true },
      ),
      removeResolved: runtime.fn(
        Effect.fn('Reviews.deleteResolvedComments')(function* (
          threads: ConfirmedThreads,
        ) {
          const api = yield* porcelainClient(connection);
          const state = yield* CommentThreadsState;
          const result = yield* state.confirm(
            requestEffect(
              api.reviews.deleteResolvedComments({
                params,
                payload: { threads },
              }),
            ),
            (previous, answer) =>
              Option.some(
                mergeCommentThreads(
                  Option.getOrElse(previous, () => []),
                  [],
                  answer.deleted,
                ),
              ),
          );
          yield* inventory;
          return result;
        }),
        { concurrent: true },
      ),
      seen: runtime.fn(
        Effect.fn('Reviews.markCommentsSeen')(function* (
          throughRevision: number,
        ) {
          const api = yield* porcelainClient(connection);
          const state = yield* CommentThreadsState;
          const result = yield* state.confirm(
            Effect.gen(function* () {
              const answer = yield* requestEffect(
                api.reviews.markCommentsSeen({
                  params,
                  payload: { throughRevision },
                }),
              );
              yield* currentAnswerEffect(
                connection.request().signal,
                answer.worktreeId === scope.worktreeId,
              );
              return answer;
            }),
            (previous) => previous,
          );
          yield* inventory;
          return result;
        }),
        { concurrent: true },
      ),
    };
  },
);
