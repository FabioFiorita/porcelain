import {
  useQueries,
  useQueryErrorResetBoundary,
  useSuspenseQueries,
} from '@tanstack/react-query';
import {
  type ReviewChangeItem,
  type ReviewScope,
  mergeReviewChanges,
  reviewedQueryOptions,
} from '@/features/reviews/index';

import { useConnectedContext } from '@/app/workspace-provider';
import { changesQueryOptions } from '@/features/changes';
import { textQueryOptions } from '@/features/files/index';

export function useReviewReset() {
  return useQueryErrorResetBoundary();
}
export function useReviewChanges(
  scope: ReviewScope,
  paths?: readonly string[],
): ReviewChangeItem[] {
  const context = useConnectedContext();
  const [list, reviewed] = useSuspenseQueries({
    queries: [
      changesQueryOptions(scope, context.connection),
      reviewedQueryOptions(scope, context),
    ],
  });
  return mergeReviewChanges(list.data.changes, reviewed.data, paths);
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
