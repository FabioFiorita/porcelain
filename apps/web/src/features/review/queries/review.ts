import { ConnectionError } from '@/shared/api/connection-error';
import {
  usePrefetchQuery,
  useQueries,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
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
} from '@/features/review/model/review';
import { reviewMark, reviewStatus } from '@/features/review/model/review';
import { queryKeys } from '@/shared/query/keys';
import { usePublishedReview } from '@/features/review/queries/published-review';
import { useConnectedContext } from '@/app/workspace-provider';
import { changesQueryOptions } from '@/features/changes';
import { textQueryOptions } from '@/features/files/index';

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

export function useReviewReset() {
  return useQueryErrorResetBoundary();
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
      ...textQueryOptions(
        context.connection.environmentId,
        scope,
        path,
        context.connection.request,
      ),
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
