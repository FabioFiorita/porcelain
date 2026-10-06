import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { Effect } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { WriteQueues } from '../../../shared/api/write-queue.ts';
import { reviewsApi } from '../api.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { commentsQueryOptions } from '../queries/comments.ts';
import type { CommentThread, ConfirmedThreads } from '../rules/comments.ts';
import type {
  CreateCommentThreadRequest,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
  EditCommentMessageRequest,
} from '@porcelain/contracts/reviews';

type ReplyCommentInput = { threadId: string } & ReplyToCommentRequest;
type ResolveCommentInput = { threadId: string } & UpdateCommentThreadRequest;
type EditCommentInput = { threadId: string } & EditCommentMessageRequest;
type DeleteCommentInput = { threadId: string; messageId: string };

export function commentCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = reviewsApi(connection);
  const key = commentsQueryOptions(scope, connection).queryKey;

  const enqueue = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
    WriteQueues.use((queues) => queues.run(key, operation));
  const request = () => ({ ...scope, ...connection.request() });

  function merge(
    updated: readonly CommentThread[],
    refreshInventory: boolean,
    signal: AbortSignal,
    removed: readonly string[] = [],
  ) {
    return Effect.gen(function* () {
      yield* nativeOperation(() =>
        client.cancelQueries({ queryKey: key, exact: true }),
      );
      yield* currentAnswerEffect(signal);
      client.setQueryData<CommentThread[]>(key, (current) => {
        const byId = new Map(
          (current ?? []).map((thread) => [thread.id, thread]),
        );
        for (const thread of updated) byId.set(thread.id, thread);
        for (const threadId of removed) byId.delete(threadId);
        return [...byId.values()];
      });
      if (refreshInventory)
        yield* nativeOperation(() =>
          client.invalidateQueries({
            queryKey: queryKeys.inventory(connection.environmentId),
          }),
        );
    });
  }

  function threads<T, E>(
    input: T,
    send: (
      connected: ReturnType<typeof request>,
      input: T,
    ) => Effect.Effect<CommentThread, E>,
    refreshInventory = false,
  ) {
    return enqueue(
      Effect.gen(function* () {
        const connected = request();
        yield* currentAnswerEffect(connected.signal);
        const result = [yield* send(connected, input)];
        yield* currentAnswerEffect(
          connected.signal,
          result.every((thread) => thread.worktreeId === scope.worktreeId),
        );
        yield* merge(result, refreshInventory, connected.signal);
        return result;
      }),
    );
  }

  return {
    create: (input: CreateCommentThreadRequest) =>
      threads(input, (connected, input) =>
        requestEffect(
          api.createCommentThread({
            params: { worktreeId: scope.worktreeId },
            payload: input,
          }),
          connected.signal,
        ),
      ),
    reply: (input: ReplyCommentInput) =>
      threads(
        input,
        (connected, { threadId, body, messageId }) =>
          requestEffect(
            api.replyToComment({
              params: { worktreeId: scope.worktreeId, threadId },
              payload: { body, messageId },
            }),
            connected.signal,
          ),
        true,
      ),
    resolve: (input: ResolveCommentInput) =>
      threads(input, (connected, { threadId, resolved }) =>
        requestEffect(
          api.updateCommentThread({
            params: { worktreeId: scope.worktreeId, threadId },
            payload: { resolved },
          }),
          connected.signal,
        ),
      ),
    edit: (input: EditCommentInput) =>
      threads(input, (connected, { threadId, messageId, body }) =>
        requestEffect(
          api.editCommentMessage({
            params: { worktreeId: scope.worktreeId, threadId },
            payload: { messageId, body },
          }),
          connected.signal,
        ),
      ),
    remove: (input: DeleteCommentInput) =>
      enqueue(
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            api.deleteCommentMessage({
              params: {
                worktreeId: scope.worktreeId,
                threadId: input.threadId,
              },
              query: { messageId: input.messageId },
            }),
            connected.signal,
          );
          const updated = result.thread ? [result.thread] : [];
          yield* currentAnswerEffect(
            connected.signal,
            updated.every((thread) => thread.worktreeId === scope.worktreeId),
          );
          yield* merge(
            updated,
            true,
            connected.signal,
            result.thread ? [] : [result.threadId],
          );
          return result;
        }),
      ),
    removeResolved: (threads: ConfirmedThreads) =>
      enqueue(
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            api.deleteResolvedComments({
              params: { worktreeId: scope.worktreeId },
              payload: { threads },
            }),
            connected.signal,
          );
          yield* currentAnswerEffect(connected.signal);
          yield* merge([], true, connected.signal, result.deleted);
          return result;
        }),
      ),
    seen: (throughRevision: number) =>
      enqueue(
        Effect.gen(function* () {
          const connected = request();
          const result = yield* requestEffect(
            api.markCommentsSeen({
              params: { worktreeId: scope.worktreeId },
              payload: { throughRevision },
            }),
            connected.signal,
          );
          yield* currentAnswerEffect(
            connected.signal,
            result.worktreeId === scope.worktreeId,
          );
          yield* nativeOperation(() =>
            client.invalidateQueries({
              queryKey: queryKeys.inventory(connection.environmentId),
            }),
          );
          return result;
        }),
      ),
  };
}
