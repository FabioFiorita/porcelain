import type { QueryClient } from '@tanstack/query-core';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { createScopedWriteQueues } from '../../../shared/api/write-queue.ts';
import { commentsApi } from '../api.ts';
import { commentsQueryOptions } from '../queries/comments.ts';
import type {
  CommentThread,
  NewComment,
  ReplyCommentInput,
  ResolveCommentInput,
  EditCommentInput,
  DeleteCommentInput,
  ConfirmedThreads,
} from '../ports/comments.ts';

const writeQueue = createScopedWriteQueues();

export function commentCommands(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  client: QueryClient,
) {
  const api = commentsApi(connection);
  const key = commentsQueryOptions(scope, connection).queryKey;
  const queue = writeQueue(connection, key);
  const request = () => ({ ...scope, ...connection.request() });

  async function merge(
    updated: CommentThread[],
    refreshInventory: boolean,
    signal: AbortSignal,
    removed: readonly string[] = [],
  ) {
    await client.cancelQueries({ queryKey: key, exact: true });
    assertCurrentAnswer(signal);
    client.setQueryData<CommentThread[]>(key, (current) => {
      const byId = new Map(
        (current ?? []).map((thread) => [thread.id, thread]),
      );
      for (const thread of updated) byId.set(thread.id, thread);
      for (const threadId of removed) byId.delete(threadId);
      return [...byId.values()];
    });
    if (refreshInventory)
      await client.invalidateQueries({
        queryKey: queryKeys.inventory(connection.environmentId),
      });
  }

  function threads<T>(
    input: T,
    send: (
      connected: ReturnType<typeof request>,
      input: T,
    ) => Promise<CommentThread[]>,
    refreshInventory = false,
  ) {
    return queue.enqueue(async () => {
      const connected = request();
      const result = await send(connected, input);
      assertCurrentAnswer(
        connected.signal,
        result.every((thread) => thread.worktreeId === scope.worktreeId),
      );
      await merge(result, refreshInventory, connected.signal);
      return result;
    });
  }

  return {
    create: (input: NewComment) =>
      threads(input, (connected, input) => api.create({ ...connected, input })),
    reply: (input: ReplyCommentInput) =>
      threads(
        input,
        (connected, { threadId, body, messageId }) =>
          api.reply({ ...connected, threadId, input: { body, messageId } }),
        true,
      ),
    resolve: (input: ResolveCommentInput) =>
      threads(input, (connected, { threadId, resolved }) =>
        api.resolve({ ...connected, threadId, input: { resolved } }),
      ),
    edit: (input: EditCommentInput) =>
      threads(input, (connected, input) =>
        api.edit({ ...connected, ...input }),
      ),
    remove: (input: DeleteCommentInput) =>
      queue.enqueue(async () => {
        const connected = request();
        const result = await api.remove({ ...connected, ...input });
        const updated = result.thread ? [result.thread] : [];
        assertCurrentAnswer(
          connected.signal,
          updated.every((thread) => thread.worktreeId === scope.worktreeId),
        );
        await merge(
          updated,
          true,
          connected.signal,
          result.thread ? [] : [result.threadId],
        );
        return result;
      }),
    removeResolved: (threads: ConfirmedThreads) =>
      queue.enqueue(async () => {
        const connected = request();
        const result = await api.removeResolved({ ...connected, threads });
        assertCurrentAnswer(connected.signal);
        await merge([], true, connected.signal, result.deleted);
        return result;
      }),
    seen: (throughRevision: number) =>
      queue.enqueue(async () => {
        const connected = request();
        const result = await api.seen({ ...connected, throughRevision });
        assertCurrentAnswer(
          connected.signal,
          result.worktreeId === scope.worktreeId,
        );
        await client.invalidateQueries({
          queryKey: queryKeys.inventory(connection.environmentId),
        });
        return result;
      }),
  };
}
