import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  useMutation,
  useQueries,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewPort, ReviewRequest } from '../api/review/port';
import type { DiffRequest, ReviewScope } from '../domain/review';
import { queryKeys } from './keys';
import { asMutation } from './mutation';
import { useConnectedContext } from './workspace-provider';

function useReviewData<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
) {
  const { api, connection } = useConnectedContext();
  return useSuspenseQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, key),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await read(api.review, { ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
  }).data;
}
export function useDirectory(scope: ReviewScope, path: string) {
  return useReviewData(scope, ['directory', path], (api, request) =>
    api.directory({ ...request, path }),
  );
}
export function useDirectories(scope: ReviewScope, paths: readonly string[]) {
  const { api, connection } = useConnectedContext();
  return useQueries({
    queries: paths.map((path) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'directory',
        path,
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.directory({ ...scope, ...request, path });
        request.signal.throwIfAborted();
        return data;
      },
    })),
  });
}
export function useChanges(scope: ReviewScope) {
  const { connection } = useConnectedContext();
  return useReviewData(scope, ['changes'], async (api, request) => {
    const data = await api.changes(request);
    if (
      data.status.environmentId !== connection.environmentId ||
      data.status.worktreeId !== scope.worktreeId ||
      data.layers.worktreeId !== scope.worktreeId
    )
      throw new ConnectionError(
        'The review context changed. Disconnect and connect again.',
      );
    return data;
  });
}
export function useHistory(scope: ReviewScope, cursor?: string) {
  return useReviewData(scope, ['history', cursor ?? ''], (api, request) =>
    api.history({ ...request, ...(cursor ? { cursor } : {}) }),
  );
}
export function useArtifacts(scope: ReviewScope) {
  return useReviewData(scope, ['artifacts'], (api, request) =>
    api.artifacts(request),
  );
}
export function reviewErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
export function useTextFile(scope: ReviewScope, path: string) {
  return useReviewData(scope, ['text', path], (api, request) =>
    api.text({ ...request, path }),
  );
}
export function useCommit(scope: ReviewScope, oid: string) {
  return useReviewData(scope, ['commit', oid], (api, request) =>
    api.commit({ ...request, oid }),
  );
}
export function useDiff(scope: ReviewScope, input: DiffRequest) {
  return useReviewData(scope, ['diff', input], (api, request) =>
    api.diff({ ...request, input }),
  );
}

export function useRefreshReview(scope: ReviewScope) {
  const { connection } = useConnectedContext();
  const client = useQueryClient();
  return asMutation(
    useMutation({
      mutationFn: async () => {
        await client.invalidateQueries({
          queryKey: queryKeys.review(connection.environmentId, scope),
        });
      },
    }),
  );
}
