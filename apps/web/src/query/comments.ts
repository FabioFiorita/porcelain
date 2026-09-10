import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { NewComment } from '../domain/comments';
import type { ReviewScope } from '../domain/review';
import { asMutation } from './mutation';
import { useWorkspaceContext } from './workspace-provider';

function useCommentContext(scope: ReviewScope) {
  const { api, connection } = useWorkspaceContext();
  if (!connection) throw new Error('A connected environment is required');
  return {
    api: api.comments,
    key: [
      'review',
      connection.environmentId,
      scope.projectId,
      scope.worktreeId,
      'comments',
    ],
    request: (signal?: AbortSignal) => ({
      ...scope,
      token: connection.token,
      signal: AbortSignal.any([
        connection.controller.signal,
        AbortSignal.timeout(15_000),
        ...(signal ? [signal] : []),
      ]),
    }),
  };
}
export function useComments(scope: ReviewScope) {
  const context = useCommentContext(scope);
  const query = useSuspenseQuery({
    queryKey: context.key,
    queryFn: async ({ signal }) => {
      const request = context.request(signal);
      const result = await context.api.list(request);
      request.signal.throwIfAborted();
      return result;
    },
  });
  return { threads: query.data, error: query.error };
}
export function useCreateComment(scope: ReviewScope) {
  const context = useCommentContext(scope);
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: async (input: NewComment) => {
        const request = context.request();
        const result = await context.api.create({ ...request, input });
        request.signal.throwIfAborted();
        return result;
      },
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: context.key });
      },
    }),
  );
}
