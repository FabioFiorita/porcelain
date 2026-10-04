import { pathDiffReadsQueryOptions } from '@porcelain/client/changes';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import { useBatchedReads } from './batched-reads';
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
  const batched = useBatchedReads(
    pathDiffReadsQueryOptions({
      connection,
      paths,
      key,
      read,
      size: DIFF_WINDOW_FILES,
    }),
  );
  return {
    patches: new Map<string, Content>(batched.entries),
    isPending: batched.pending,
    isError: batched.failed,
    retry: batched.retry,
  };
}
