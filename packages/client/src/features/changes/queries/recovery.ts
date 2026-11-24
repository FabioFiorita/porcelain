import { Cause, Effect, Stream } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { DIFFS_PER_REQUEST } from '@porcelain/contracts/shared';
import { isStaleChangeObservation } from '../../../shared/api/stale-answer.ts';
import { diffBatches } from '../rules/diff-batches.ts';
import type { ChangeSelection, ExpectedFile } from '../rules/changes.ts';
import {
  readChangeDiffs,
  readDiffBatches,
  readCompleteDiffWindow,
} from './diffs.ts';
import { readCurrentDiffObservation } from './read-current-observation.ts';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import {
  ChangedDiffRecovery,
  recoveryKey,
  recoveryRuntime,
  worktreeRecovery,
} from '../store/recovery.ts';

const readDiffRecovery = Atom.family(
  ({
    connection,
    scope,
    read,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    read: number;
  }) =>
    recoveryRuntime(connection).atom(
      Stream.unwrap(
        Effect.map(ChangedDiffRecovery, (recovery) => recovery.changes),
      ).pipe(
        Stream.map((state) => {
          const worktree = worktreeRecovery(state, recoveryKey(scope));
          return {
            pending: worktree.refreshing,
            attempted: read <= worktree.refreshedThrough,
          };
        }),
      ),
    ),
);

export const readChangeDiffWindow = Atom.family(
  (selection: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    statusToken: string;
    read: number;
    expectedFiles: readonly ExpectedFile[];
    selections: readonly ChangeSelection[];
  }) => {
    const { connection, scope, statusToken, read } = selection;
    const queries = diffBatches(
      selection.expectedFiles,
      selection.selections,
      DIFFS_PER_REQUEST,
    ).map((batch) =>
      readChangeDiffs({
        connection,
        scope,
        input: {
          expectedStatusToken: statusToken,
          expectedFiles: batch.expectedFiles,
          selections: batch.selections,
        },
      }),
    );
    const batches = readDiffBatches(queries);
    const window = readCompleteDiffWindow(queries);
    const recover = readCurrentDiffObservation({ connection, scope });
    return Atom.readable(
      (get) => {
        get.mount(recover);
        const results = get(batches);
        const recovery = get(readDiffRecovery({ connection, scope, read }));
        if (
          AsyncResult.isSuccess(recovery) &&
          !recovery.value.attempted &&
          !recovery.value.pending &&
          results.some(
            (result) =>
              AsyncResult.isFailure(result) &&
              isStaleChangeObservation(Cause.squash(result.cause)),
          )
        ) {
          get.set(recover, read);
        }
        return {
          result: get(window),
          recovery,
        };
      },
      (refresh) => refresh(batches),
    ).pipe(Atom.setIdleTTL(0));
  },
);
