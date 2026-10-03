import { useQueries } from '@tanstack/react-query';

type BatchedReads<Batch, Entry> = {
  batches: readonly Batch[];
  key: (batch: Batch) => readonly unknown[];
  read: (batch: Batch, signal: AbortSignal) => Promise<readonly Entry[]>;
  retry?: (failureCount: number, error: Error) => boolean;
};

export function useBatchedReads<Batch, Entry>({
  batches,
  key,
  read,
  retry,
}: BatchedReads<Batch, Entry>) {
  const results = useQueries({
    queries: batches.map((batch) => ({
      queryKey: key(batch),
      queryFn: ({ signal }: { signal: AbortSignal }) => read(batch, signal),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      throwOnError: false,
      ...(retry ? { retry } : {}),
    })),
  });
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
