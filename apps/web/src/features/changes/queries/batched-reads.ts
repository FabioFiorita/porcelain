import { useAtomRefresh } from '@effect/atom-react';
import { readDiffBatches } from '@porcelain/client/changes';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useMountedRead } from '@/shared/query/mounted-read';

function useBatchedReads(queries: Parameters<typeof readDiffBatches>[0]) {
  const batches = readDiffBatches(queries);
  return { results: useMountedRead(batches), retry: useAtomRefresh(batches) };
}

export function usePathDiffs(queries: Parameters<typeof readDiffBatches>[0]) {
  const reads = useBatchedReads(queries);
  return {
    patches: new Map(
      (reads.results ?? []).flatMap((result) =>
        Option.toArray(AsyncResult.value(result)).flatMap((entries) => [
          ...entries,
        ]),
      ),
    ),
    pending: reads.results?.some(AsyncResult.isInitial) ?? queries.length > 0,
    failed: reads.results?.some(AsyncResult.isFailure) ?? false,
    retry: reads.retry,
  };
}
