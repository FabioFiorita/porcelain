import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import {
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { ConnectionError } from '@/shared/api/connection-error';
import { queryKeys } from '@/shared/query/keys';
import { asMutation } from '@/shared/query/mutation';
import { commentsQueryOptions } from '../queries/comments';
import type {
  CommentsContext,
  CommentThread,
  DeleteCommentInput,
  EditCommentInput,
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
  removed: readonly string[] = [],
) {
  await client.cancelQueries({ queryKey: key, exact: true });
  client.setQueryData<CommentThread[]>(key, (current) => {
    const byId = new Map((current ?? []).map((thread) => [thread.id, thread]));
    for (const thread of updated) byId.set(thread.id, thread);
    for (const threadId of removed) byId.delete(threadId);
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

function withSend<TData, TVariables>(
  mutation: UseMutationResult<TData, Error, TVariables>,
) {
  return {
    ...asMutation(mutation),
    send: (input: TVariables, onSent?: () => void) => {
      void mutation.mutateAsync(input).then(onSent, () => undefined);
    },
  };
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
  const create = withSend(
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
  return { ...create, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useReplyComment(scope: ReviewScope, comments: CommentsContext) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  const reply = withSend(
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
  return { ...reply, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useResolveComment(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return withSend(
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

export function useEditComment(scope: ReviewScope, comments: CommentsContext) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  const edit = withSend(
    useMutation({
      mutationFn: (input: EditCommentInput) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.edit({ ...request, ...input });
          request.signal.throwIfAborted();
          const scoped = assertCommentScope(result, scope.worktreeId);
          await mergeCommentThreads(client, context.key, scoped);
          return scoped;
        }),
    }),
  );
  return { ...edit, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useDeleteComment(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return withSend(
    useMutation({
      mutationFn: (input: DeleteCommentInput) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.remove({ ...request, ...input });
          request.signal.throwIfAborted();
          const kept = assertCommentScope(
            result.thread ? [result.thread] : [],
            scope.worktreeId,
          );
          await mergeCommentThreads(
            client,
            context.key,
            kept,
            queryKeys.inventory(context.connection.environmentId),
            result.thread ? [] : [result.threadId],
          );
          return result;
        }),
    }),
  );
}

export function useDeleteResolvedComments(
  scope: ReviewScope,
  comments: CommentsContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return withSend(
    useMutation({
      mutationFn: () =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await context.api.removeResolved(request);
          request.signal.throwIfAborted();
          await mergeCommentThreads(
            client,
            context.key,
            [],
            queryKeys.inventory(context.connection.environmentId),
            result.deleted,
          );
          return result;
        }),
    }),
  );
}
