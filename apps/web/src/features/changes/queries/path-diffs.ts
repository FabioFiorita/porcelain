import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useBatchedReads } from './batched-reads';
import { consecutiveBatches } from '../rules/diff-batches';
import { type Connection } from '@/shared/workspace/connection';

type PathBatch = readonly (readonly string[])[];

export function usePathDiffs<Content>({
  connection,
  paths,
  key,
  read,
}: {
  connection: Connection;
  paths: PathBatch;
  key: (batch: PathBatch) => readonly unknown[];
  read: (
    signal: AbortSignal,
    paths: string[][],
  ) => Promise<{
    diffs: readonly { paths: readonly string[]; content: Content }[];
  }>;
}) {
  const batched = useBatchedReads({
    batches: consecutiveBatches(paths, DIFF_WINDOW_FILES),
    key,
    read: async (batch, signal) => {
      const request = connection.request(signal);
      const data = await read(
        request.signal,
        batch.map((entry) => [...entry]),
      );
      request.signal.throwIfAborted();
      return data.diffs.map(
        (diff) => [diff.paths.join('\0'), diff.content] as const,
      );
    },
  });
  return {
    patches: new Map<string, Content>(batched.entries),
    isPending: batched.pending,
    isError: batched.failed,
    retry: batched.retry,
  };
}
