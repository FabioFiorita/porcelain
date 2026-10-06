import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { readDiffBatches } from '@porcelain/client/changes';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';

function useBatchedReads(queries: Parameters<typeof readDiffBatches>[0]) {
  const batches = readDiffBatches(queries);
  return { results: useAtomValue(batches), retry: useAtomRefresh(batches) };
}

export function usePathDiffs(queries: Parameters<typeof readDiffBatches>[0]) {
  const reads = useBatchedReads(queries);
  return {
    patches: new Map(
      reads.results.flatMap((result) =>
        Option.toArray(AsyncResult.value(result)).flatMap((entries) => [
          ...entries,
        ]),
      ),
    ),
    pending: reads.results.some(AsyncResult.isInitial),
    failed: reads.results.some(AsyncResult.isFailure),
    retry: reads.retry,
  };
}
