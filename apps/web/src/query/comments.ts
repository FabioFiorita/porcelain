import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  useMutation,
  usePrefetchQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type {
  CommentResolution,
  CommentThread,
  NewComment,
  NewReply,
} from '../domain/comments';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

function useCommentContext(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.comments,
    key: queryKeys.comments(connection.environmentId, scope),
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
  context: ReturnType<typeof useCommentContext>,
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

function useCommentsOptions(scope: ReviewScope) {
  const context = useCommentContext(scope);
  return {
    queryKey: context.key,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = context.request(signal);
      const result = await context.api.list(request);
      request.signal.throwIfAborted();
      return assertCommentScope(result, scope.worktreeId);
    },
  };
}

export function useComments(scope: ReviewScope) {
  const query = useSuspenseQuery(useCommentsOptions(scope));
  return { threads: query.data, error: query.error };
}

export function usePrefetchComments(scope: ReviewScope) {
  usePrefetchQuery(useCommentsOptions(scope));
}

export function useMarkCommentsSeen(scope: ReviewScope) {
  const context = useCommentContext(scope);
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
export function useCreateComment(scope: ReviewScope) {
  const context = useCommentContext(scope);
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

export type ReplyCommentInput = { threadId: string } & NewReply;

export function useReplyComment(scope: ReviewScope) {
  const context = useCommentContext(scope);
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

export type ResolveCommentInput = { threadId: string } & CommentResolution;

export function useResolveComment(scope: ReviewScope) {
  const context = useCommentContext(scope);
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
