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
  // A list request may have started before the command and can otherwise
  // finish after it, restoring an older snapshot over the mutation result.
  // Cancel only this exact worktree query, then apply the command response.
  await client.cancelQueries({ queryKey: key, exact: true });
  client.setQueryData<CommentThread[]>(key, (current) => {
    if (!current) return [...updated];
    const byId = new Map(current.map((thread) => [thread.id, thread]));
    for (const thread of updated) byId.set(thread.id, thread);
    return [...byId.values()];
  });
  // Only passed by the write that can change what the sidebar says: the dot
  // travels with the worktree list, so that list is what goes stale.
  if (inventoryKey) void client.invalidateQueries({ queryKey: inventoryKey });
}

type CommentQueue = { tail: Promise<void> };
const commentQueues = new WeakMap<object, Map<string, CommentQueue>>();

/**
 * Comment commands return snapshots for the affected thread. Serialize
 * commands for one connection and worktree so a delayed response cannot
 * overwrite a later reply or resolution in the cache.
 */
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

/**
 * Tell the server how far the discussion has been read.
 *
 * Called when the discussion is on screen, with the highest revision it is
 * showing — not "now", which would also acknowledge a reply that arrived
 * after this snapshot and would then never light the dot.
 */
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
      // The dot travels with the worktree list, so that is what changed.
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
          // Answering is reading: a reply of the owner's takes the agent's
          // last word away, which is what the dot was showing.
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
