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
  CommentThread,
  DeleteCommentInput,
  ConfirmedThreads,
  EditCommentInput,
  NewComment,
  ReplyCommentInput,
  ResolveCommentInput,
} from '../rules/comments';
import type { ReviewScope } from '../rules/review';
import { type ConnectionContext } from '@/shared/workspace/connection';
import { commentsApi } from '../api';

function commentContext(scope: ReviewScope, context: ConnectionContext) {
  const { connection } = context;
  return {
    api: commentsApi(connection),
    key: commentsQueryOptions(scope, context).queryKey,
    connection,
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
    }),
  };
}

type CommentContext = ReturnType<typeof commentContext>;
type CommentRequest = ReturnType<CommentContext['request']>;

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
  context: CommentContext,
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
  comments: ConnectionContext,
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
function useThreadsCommand<TVariables>(
  scope: ReviewScope,
  comments: ConnectionContext,
  send: (
    context: CommentContext,
    request: CommentRequest,
    input: TVariables,
  ) => Promise<CommentThread[]>,
  refreshesInventory = false,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  return withSend(
    useMutation({
      mutationFn: (input: TVariables) =>
        enqueueComment(context, async () => {
          const request = context.request();
          const result = await send(context, request, input);
          request.signal.throwIfAborted();
          const scoped = assertCommentScope(result, scope.worktreeId);
          await mergeCommentThreads(
            client,
            context.key,
            scoped,
            refreshesInventory
              ? queryKeys.inventory(context.connection.environmentId)
              : undefined,
          );
          return scoped;
        }),
    }),
  );
}

export function useCreateComment(
  scope: ReviewScope,
  comments: ConnectionContext,
) {
  const create = useThreadsCommand(
    scope,
    comments,
    ({ api }, request, input: NewComment) => api.create({ ...request, input }),
  );
  return { ...create, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useReplyComment(
  scope: ReviewScope,
  comments: ConnectionContext,
) {
  const reply = useThreadsCommand(
    scope,
    comments,
    ({ api }, request, { threadId, body, messageId }: ReplyCommentInput) =>
      api.reply({ ...request, threadId, input: { body, messageId } }),
    true,
  );
  return { ...reply, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useResolveComment(
  scope: ReviewScope,
  comments: ConnectionContext,
) {
  return useThreadsCommand(
    scope,
    comments,
    ({ api }, request, { threadId, resolved }: ResolveCommentInput) =>
      api.resolve({ ...request, threadId, input: { resolved } }),
  );
}

export function useEditComment(
  scope: ReviewScope,
  comments: ConnectionContext,
) {
  const edit = useThreadsCommand(
    scope,
    comments,
    ({ api }, request, input: EditCommentInput) =>
      api.edit({ ...request, ...input }),
  );
  return { ...edit, bodyLimit: COMMENT_BODY_LENGTH };
}

export function useDeleteComment(
  scope: ReviewScope,
  comments: ConnectionContext,
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
  comments: ConnectionContext,
) {
  const context = commentContext(scope, comments);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (threads: ConfirmedThreads) =>
      enqueueComment(context, async () => {
        const request = context.request();
        const result = await context.api.removeResolved({
          ...request,
          threads,
        });
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
  });
  return { ...withSend(mutation), result: mutation.data };
}
