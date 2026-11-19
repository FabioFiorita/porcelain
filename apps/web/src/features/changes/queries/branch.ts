import {
  readBranchChanges,
  readBranchBases,
  readBranchDiffs,
} from '@porcelain/client/changes';
import { useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import { useMountedRead } from '@/shared/query/mounted-read';
import { usePathDiffs } from './batched-reads';
import {
  consecutiveBatches,
  type BranchRange,
  type ChangesScope,
} from '@porcelain/client/changes/rules';
import { DIFF_WINDOW_FILES } from '@/config/limits';
import type { Connection } from '@/shared/workspace/connection';

const initialBases =
  AsyncResult.initial<Atom.Success<ReturnType<typeof readBranchBases>>>();
const inactiveBases = Atom.make(initialBases);

const initialChanges =
  AsyncResult.initial<Atom.Success<ReturnType<typeof readBranchChanges>>>();
const inactiveChanges = Atom.make(initialChanges);

export function useBranchChanges(
  scope: ChangesScope | undefined,
  connection: Connection,
  base: string | undefined,
) {
  const state = scope
    ? readBranchChanges({
        connection,
        scope,
        ...(base === undefined ? {} : { base }),
      })
    : inactiveChanges;
  return {
    result: useMountedRead(state) ?? initialChanges,
    refresh: useAtomRefresh(state),
  };
}
export function useBranchBases(
  scope: ChangesScope,
  connection: Connection,
  enabled: boolean,
) {
  const state = enabled
    ? readBranchBases({ connection, scope })
    : inactiveBases;
  return {
    result: useMountedRead(state) ?? initialBases,
    refresh: useAtomRefresh(state),
  };
}
export function useBranchDiffs(
  scope: ChangesScope,
  connection: Connection,
  range: BranchRange | null,
  paths: readonly (readonly string[])[],
) {
  return usePathDiffs(
    range
      ? consecutiveBatches(paths, DIFF_WINDOW_FILES).map((batch) =>
          readBranchDiffs({
            connection,
            scope,
            input: {
              baseOid: range.baseOid,
              headOid: range.headOid,
              paths: batch.map((entry) => [...entry]),
            },
          }),
        )
      : [],
  );
}
