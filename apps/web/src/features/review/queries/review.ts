import { ConnectionError } from '@/shared/api/connection-error';
import { RequestError } from '@/shared/api/request';
import {
  usePrefetchQuery,
  useQueries,
  useQuery,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type {
  ReviewPort,
  ReviewRequest,
} from '@/features/review/api/review-port';
import type {
  ChangeList,
  ReviewChangeItem,
  ReviewedMarksResponse,
  ReviewScope,
  TextFile,
} from '@/features/review/model/review';
import { reviewMark, reviewStatus } from '@/features/review/model/review';
import { queryKeys } from '@/shared/query/keys';
import { usePublishedReview } from '@/features/review/queries/published-review';
import { useConnectedContext } from '@/app/workspace-provider';
import { changesQueryOptions } from '@/features/changes';

function useReviewOptions<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
) {
  const { api, connection } = useConnectedContext();
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, key),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await read(api.review, { ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
  };
}
function useReviewData<T>(
  scope: ReviewScope,
  key: readonly unknown[],
  read: (api: ReviewPort, request: ReviewRequest) => Promise<T>,
  refetchInterval: number | false = false,
  onFocus: 'always' | false = false,
) {
  return useSuspenseQuery({
    ...useReviewOptions(scope, key, read),
    refetchInterval,
    refetchOnWindowFocus: onFocus,
    refetchOnReconnect: onFocus,
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
export function useHasReviewLayers(scope: ReviewScope) {
  return usePublishedReview(scope).data?.active ?? false;
}

function useReviewedOptions(scope: ReviewScope) {
  return useReviewOptions<ReviewedMarksResponse>(
    scope,
    ['reviewed'],
    (api, request) => api.reviewed.list(request),
  );
}

export function usePrefetchReview(scope: ReviewScope) {
  const { connection } = useConnectedContext();
  usePrefetchQuery(changesQueryOptions(scope, connection));
  usePrefetchQuery(useReviewedOptions(scope));
}

export function reviewErrorMessage(error: unknown) {
  return error instanceof ConnectionError
    ? error.message
    : 'This review surface could not be loaded. Try again.';
}

export function isContentChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'content_changed'
  );
}

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
type ReadFile = TextFile | { kind: 'unreadable'; reason: string };

function readFile(api: ReviewPort, request: ReviewRequest, path: string) {
  return async (): Promise<ReadFile> => {
    try {
      return await api.text({ ...request, path });
    } catch (error) {
      if (error instanceof RequestError && error.status === 422) {
        if (error.code === 'unsupported_text')
          return {
            kind: 'unreadable',
            reason: 'This file is binary or uses an unsupported text encoding.',
          };
        if (error.code === 'file_too_large')
          return {
            kind: 'unreadable',
            reason: 'This file is too large to display as text.',
          };
      }
      throw error;
    }
  };
}

function textFileOptions(
  { api, connection }: ReturnType<typeof useConnectedContext>,
  scope: ReviewScope,
  path: string,
) {
  return {
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'text',
      path,
    ]),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const request = connection.request(signal);
      const data = await readFile(api.review, { ...scope, ...request }, path)();
      request.signal.throwIfAborted();
      return data;
    },
  };
}

export function useTextFile(
  scope: ReviewScope,
  path: string,
  _active: boolean,
) {
  const context = useConnectedContext();
  return useSuspenseQuery({
    ...textFileOptions(context, scope, path),
    refetchInterval: false,
  }).data;
}
export function useReviewChanges(
  scope: ReviewScope,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const { connection } = useConnectedContext();
  const [list, reviewed] = useSuspenseQueries({
    queries: [
      changesQueryOptions(scope, connection),
      useReviewedOptions(scope),
    ],
  });
  return mergeReviewChanges(list.data.changes, reviewed.data, paths);
}

function mergeReviewChanges(
  list: ChangeList,
  reviewed: ReviewedMarksResponse,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const selected = paths == null ? null : new Set(paths);
  return list.changes.flatMap((entry) => {
    if (selected && !selected.has(entry.path)) return [];
    const mark = reviewMark(entry, reviewed.marks);
    return [
      {
        ...entry,
        environmentId: list.environmentId,
        worktreeId: list.worktreeId,
        statusToken: list.statusToken,
        reviewStatus: reviewStatus(entry, reviewed.marks),
        ...(mark ? { mark } : {}),
      },
    ];
  });
}

export function useUntrackedContents(
  scope: ReviewScope,
  paths: readonly string[],
) {
  const context = useConnectedContext();
  const queries = useQueries({
    queries: paths.map((path) => ({
      ...textFileOptions(context, scope, path),
      throwOnError: false,
    })),
  });
  return {
    contents: new Map(
      paths.flatMap((path, index) => {
        const data = queries[index]?.data;
        return data === undefined || !('text' in data)
          ? []
          : [[path, data.text] as const];
      }),
    ),
    pending: queries.some((query) => query.isPending),
    failed: queries.some((query) => query.isError),
    retry: () => {
      for (const query of queries) void query.refetch();
    },
  };
}

export function useWorktreePaths(scope: ReviewScope, enabled = true) {
  const { api, connection } = useConnectedContext();
  return useQuery({
    enabled,
    queryKey: queryKeys.reviewSurface(connection.environmentId, scope, [
      'paths',
    ]),
    queryFn: async ({ signal }) => {
      const request = connection.request(signal);
      const data = await api.review.worktreePaths({ ...scope, ...request });
      request.signal.throwIfAborted();
      return data;
    },
    retry: false,
    throwOnError: false,
  });
}
