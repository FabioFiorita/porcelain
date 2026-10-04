import { useQueries, type UseQueryOptions } from '@tanstack/react-query';

export function useBatchedReads<Entry>(
  queries: UseQueryOptions<readonly Entry[]>[],
) {
  const results = useQueries({ queries });
  return {
    entries: results.flatMap((result) => result.data ?? []),
    complete: results.every((result) => result.data !== undefined),
    pending: results.some((result) => result.isPending),
    failed: results.some((result) => result.isError),
    retry: () => {
      for (const result of results) if (result.isError) void result.refetch();
    },
  };
}
