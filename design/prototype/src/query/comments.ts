import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewScope } from '../api/api';
import type { CommentAnchor, CommentThread } from '../contracts/comments';
import { createId } from '../lib/id';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

export function useComments(scope: ReviewScope): CommentThread[] {
  const { api, environmentId } = useWorkspaceContext();
  return useSuspenseQuery({
    queryKey: queryKeys.resource(environmentId, scope, 'comments'),
    queryFn: ({ signal }) => api.comments.list({ ...scope, signal }),
  }).data;
}

/**
 * Every comment write answers with the thread; it replaces that thread in the cache,
 * so nothing reloads and nothing touches Git. The sidebar dot follows from the
 * inventory notice the server sends.
 */
function useThreadMutation<TInput>(
  scope: ReviewScope,
  mutationFn: (input: TInput) => Promise<CommentThread>,
) {
  const { environmentId } = useWorkspaceContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn,
      onSuccess: (thread) => {
        client.setQueryData<CommentThread[]>(
          queryKeys.resource(environmentId, scope, 'comments'),
          (threads = []) =>
            threads.some((entry) => entry.id === thread.id)
              ? threads.map((entry) =>
                  entry.id === thread.id ? thread : entry,
                )
              : [...threads, thread],
        );
      },
    }),
  );
}

/**
 * Opens a thread with its first message. The ids are picked here, before sending,
 * so a retry after a dropped response returns the thread instead of posting twice.
 */
export function useCreateComment(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useThreadMutation(
    scope,
    (input: {
      anchor: CommentAnchor;
      body: string;
      threadId?: string;
      messageId?: string;
    }) =>
      api.comments.create({
        ...scope,
        input: {
          anchor: input.anchor,
          body: input.body,
          threadId: input.threadId ?? createId(),
          messageId: input.messageId ?? createId(),
        },
      }),
  );
}

export function useReplyToComment(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useThreadMutation(
    scope,
    (input: { threadId: string; body: string; messageId?: string }) =>
      api.comments.reply({
        ...scope,
        threadId: input.threadId,
        input: { body: input.body, messageId: input.messageId ?? createId() },
      }),
  );
}

export function useResolveComment(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useThreadMutation(
    scope,
    (input: { threadId: string; resolved: boolean }) =>
      api.comments.resolve({
        ...scope,
        threadId: input.threadId,
        input: { resolved: input.resolved },
      }),
  );
}

/** Marks a thread seen up to its last message, on every device. Clears the yellow dot. */
export function useMarkSeen(scope: ReviewScope) {
  const { api } = useWorkspaceContext();
  return useThreadMutation(
    scope,
    (input: { threadId: string; messageId: string }) =>
      api.comments.seen({
        ...scope,
        threadId: input.threadId,
        input: { messageId: input.messageId },
      }),
  );
}
