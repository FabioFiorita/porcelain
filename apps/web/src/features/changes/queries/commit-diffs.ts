import { readCommitDiffs } from '@porcelain/client/changes';
import { usePathDiffs } from './batched-reads';
import {
  consecutiveBatches,
  type ChangesScope,
} from '@porcelain/client/changes/rules';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import type { Connection } from '@/shared/workspace/connection';

export function useCommitDiffs(
  connection: Connection,
  scope: ChangesScope,
  oid: string,
  parent: number,
  paths: readonly (readonly string[])[],
) {
  return usePathDiffs(
    consecutiveBatches(paths, DIFF_WINDOW_FILES).map((batch) =>
      readCommitDiffs({ connection, scope, oid, parent, paths: batch }),
    ),
  );
}
