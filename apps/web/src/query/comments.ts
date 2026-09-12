import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { NewComment } from '../domain/comments';
import type { ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

function useCommentContext(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    api: api.comments,
    key: queryKeys.comments(connection.environmentId, scope),
    request: (signal?: AbortSignal) => ({
      ...scope,
      ...connection.request(signal),
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
