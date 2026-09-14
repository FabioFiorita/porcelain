import { ConnectionError } from '@porcelain/client/errors/connection-error';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ReviewPort, ReviewRequest } from '../api/review/port';
import type {
  ArtifactContent,
  Change,
  DiffRequest,
  ReviewEvidence,
  ReviewScope,
} from '../domain/review';
import { changeKey } from '../domain/review';
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
  return useSuspenseQuery(useChangesOptions(scope)).data;
}

export function useReviewOverview(scope: ReviewScope) {
  return useQuery({ ...useChangesOptions(scope), throwOnError: false }).data;
}

function useChangesOptions(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'changes',
    ]),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await api.review.changes({ ...scope, ...request });
      request.signal.throwIfAborted();
      if (
        data.status.environmentId !== connection.environmentId ||
        data.status.worktreeId !== scope.worktreeId ||
        data.layers.worktreeId !== scope.worktreeId
      )
        throw new ConnectionError(
          'The review context changed. Disconnect and connect again.',
        );
      return data;
    },
  };
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
export function useArtifactsOverview(scope: ReviewScope) {
  const { api, connection } = useConnectedContext();
  return (
    useQuery({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'artifacts',
      ]),
      queryFn: async ({ signal }) => {
        const request = connection.request(signal);
        const data = await api.review.artifacts({ ...scope, ...request });
        request.signal.throwIfAborted();
        return data;
      },
      throwOnError: false,
    }).data ?? []
  );
}
export function useArtifact(scope: ReviewScope, artifactId: string) {
  return useReviewData<ArtifactContent>(
    scope,
    ['artifact', artifactId],
    (api, request) => api.artifact({ ...request, artifactId }),
  );
}

/** Fetch only the content for the currently available artifact tabs. */
export function useArtifactContents(
  scope: ReviewScope,
  artifactIds: readonly string[],
) {
  const { api, connection } = useConnectedContext();
  return useSuspenseQueries({
    queries: artifactIds.map((artifactId) => ({
      queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
        'artifact',
        artifactId,
      ]),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const request = connection.request(signal);
        const data = await api.review.artifact({
          ...scope,
          ...request,
          artifactId,
        });
        request.signal.throwIfAborted();
        return data;
      },
    })),
  }).map((result) => result.data);
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

export function useReviewEvidence(
  scope: ReviewScope,
  statusToken: string,
  changes: readonly Change[],
) {
  const { api, connection } = useConnectedContext();
  return useSuspenseQuery({
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'continuous-evidence',
      statusToken,
      changes.map(changeKey),
    ]),
    queryFn: async ({ signal }) => {
      const load = async (change: Change): Promise<ReviewEvidence> => {
        if (change.scope === 'unmerged')
          return { kind: 'omitted', change, reason: 'Merge conflict' };
        if (change.scope === 'untracked') {
          try {
            const request = connection.request(signal);
            const file = await api.review.text({
              ...scope,
              ...request,
              path: change.path,
            });
            request.signal.throwIfAborted();
            return { kind: 'file', change, text: file.text };
          } catch {
            signal.throwIfAborted();
            return { kind: 'omitted', change, reason: 'Not readable as text' };
          }
        }
        if (!change.supported)
          return { kind: 'omitted', change, reason: 'Unsupported Git entry' };
        try {
          const request = connection.request(signal);
          const response = await api.review.diff({
            ...scope,
            ...request,
            input: {
              expectedStatusToken: statusToken,
              change: {
                scope: change.scope,
                oldPath: change.oldPath,
                newPath: change.newPath,
              },
            },
          });
          request.signal.throwIfAborted();
          if (response.content.kind === 'binary')
            return { kind: 'omitted', change, reason: 'Binary change' };
          if (response.content.kind === 'omitted')
            return {
              kind: 'omitted',
              change,
              reason: `Content omitted: ${response.content.reason}`,
            };
          return { kind: 'diff', change, response };
        } catch {
          signal.throwIfAborted();
          return { kind: 'omitted', change, reason: 'Preview unavailable' };
        }
      };
      return Promise.all(changes.map(load));
    },
  }).data;
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
