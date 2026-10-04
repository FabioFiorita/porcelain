import { changeDiffReadsQueryOptions } from '@porcelain/client/changes';
import { useRecoveringChanges } from '../store';
import { useBatchedReads } from './batched-reads';
import type {
  ChangesScope,
  ChangeSelection,
  DiffContent,
  ExpectedFile,
} from '@porcelain/client/changes/rules';
import { type Connection } from '@/shared/workspace/connection';

export function useChangeDiffs(
  scope: ChangesScope,
  connection: Connection,
  statusToken: string,
  expectedFiles: readonly ExpectedFile[],
  selections: readonly ChangeSelection[],
  recover: (statusToken: string) => void,
) {
  const recovering = useRecoveringChanges(scope, connection, statusToken);
  const read = useBatchedReads(
    changeDiffReadsQueryOptions(
      scope,
      connection,
      statusToken,
      expectedFiles,
      selections,
      recover,
    ),
  );
  return {
    diffs: new Map<string, DiffContent>(read.complete ? read.entries : []),
    pending: read.pending || recovering,
    failed: read.failed && !recovering,
    retry: read.retry,
  };
}
