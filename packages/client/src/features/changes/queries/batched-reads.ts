import { assertCurrentAnswer } from '../../../shared/api/stale-answer.ts';
import type { WorktreeConnection } from '../../../shared/api/connection.ts';
import { consecutiveBatches } from '../rules/diff-batches.ts';

export function batchedReadsQueryOptions<Batch, Entry>({
  batches,
  key,
  read,
  retry,
}: {
  batches: readonly Batch[];
  key: (batch: Batch) => readonly unknown[];
  read: (batch: Batch, signal: AbortSignal) => Promise<readonly Entry[]>;
  retry?: (failureCount: number, error: Error) => boolean;
}) {
  return batches.map((batch) => ({
    queryKey: key(batch),
    queryFn: ({ signal }: { signal: AbortSignal }) => read(batch, signal),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    throwOnError: false,
    ...(retry ? { retry } : {}),
  }));
}

export function pathDiffReadsQueryOptions<Content>({
  connection,
  paths,
  size,
  key,
  read,
}: {
  connection: WorktreeConnection;
  paths: readonly (readonly string[])[];
  size: number;
  key: (batch: readonly (readonly string[])[]) => readonly unknown[];
  read: (
    signal: AbortSignal,
    paths: string[][],
  ) => Promise<{
    diffs: readonly { paths: readonly string[]; content: Content }[];
  }>;
}) {
  return batchedReadsQueryOptions({
    batches: consecutiveBatches(paths, size),
    key,
    read: async (batch, signal) => {
      const request = connection.request(signal);
      const data = await read(
        request.signal,
        batch.map((entry) => [...entry]),
      );
      assertCurrentAnswer(request.signal);
      return data.diffs.map(
        (diff) => [diff.paths.join('\0'), diff.content] as const,
      );
    },
  });
}
