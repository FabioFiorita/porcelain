import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { queryKeys } from '@/shared/query/keys';
import { asMutation } from '@/shared/query/mutation';
import { commentsQueryOptions } from '../queries/comments';
import type {
  CommentsContext,
  CommentThread,
  NewComment,
  ReplyCommentInput,
  ResolveCommentInput,
} from '../rules/comments';
import type { ReviewScope } from '../rules/review';

function commentContext(scope: ReviewScope, context: CommentsContext) {
  const { api, connection } = context;
  return {
    api: api.comments,
    key: commentsQueryOptions(scope, context).queryKey,
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
    }),
  };
}

function assertCommentScope(
  threads: CommentThread[],
  worktreeId: string,
): CommentThread[] {
  if (threads.some((thread) => thread.worktreeId !== worktreeId))
    throw new ConnectionError(
      'The comment context changed. Porcelain will update the discussion.',
    );
  return threads;
}

async function mergeCommentThreads(
  client: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
  updated: CommentThread[],
  inventoryKey?: readonly unknown[],
) {
  await client.cancelQueries({ queryKey: key, exact: true });
  client.setQueryData<CommentThread[]>(key, (current) => {
    if (!current) return [...updated];
    const byId = new Map(current.map((thread) => [thread.id, thread]));
    for (const thread of updated) byId.set(thread.id, thread);
    return [...byId.values()];
  });
  if (inventoryKey) void client.invalidateQueries({ queryKey: inventoryKey });
}

type CommentQueue = { tail: Promise<void> };
const commentQueues = new WeakMap<object, Map<string, CommentQueue>>();

function enqueueComment<T>(
  context: ReturnType<typeof commentContext>,
  operation: () => Promise<T>,
) {
  const queryHash = JSON.stringify(context.key) ?? '';
  let queues = commentQueues.get(context.connection);
  if (!queues) {
    queues = new Map();
    commentQueues.set(context.connection, queues);
  }
  let queue = queues.get(queryHash);
  if (!queue) {
    queue = { tail: Promise.resolve() };
    queues.set(queryHash, queue);
  }

  const result = queue.tail.then(operation, operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  queue.tail = tail;
  void tail.then(() => {
    if (queue?.tail === tail) queues?.delete(queryHash);
  });
  return result;
}

export function useMarkCommentsSeen(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (throughRevision: number) => {
      const request = context.request();
      const result = await context.api.seen({ ...request, throughRevision });
      request.signal.throwIfAborted();
      return result;
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.inventory(context.connection.environmentId),
      });
    },
  });
}
export function useCreateComment(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: (input: NewComment) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.create({ ...request, input });
          request.signal.throwIfAborted();
          const scoped = assertCommentScope(result, scope.worktreeId);
          await mergeCommentThreads(client, context.key, scoped);
          return scoped;
        }),
    }),
  );
}

export function useReplyComment(scope: ReviewScope, comments: CommentsContext) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: ({ threadId, body, messageId }: ReplyCommentInput) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.reply({
            ...request,
            threadId,
            input: { body, messageId },
          });
          request.signal.throwIfAborted();
          const scoped = assertCommentScope(result, scope.worktreeId);
          await mergeCommentThreads(
            client,
            context.key,
            scoped,
            queryKeys.inventory(context.connection.environmentId),
          );
          return scoped;
        }),
    }),
  );
}

export function useResolveComment(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: ({ threadId, resolved }: ResolveCommentInput) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.resolve({
            ...request,
            threadId,
            input: { resolved },
          });
          request.signal.throwIfAborted();
          const scoped = assertCommentScope(result, scope.worktreeId);
          await mergeCommentThreads(client, context.key, scoped);
          return scoped;
        }),
    }),
  );
}
