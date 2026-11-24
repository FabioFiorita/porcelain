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
import { diffRecoveryStep, recoveryPending } from '../rules/diff-recovery.ts';

const readWorktreeRecovery = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
  }) =>
    recoveryRuntime(connection).atom(
      Stream.unwrap(
        Effect.map(ChangedDiffRecovery, (recovery) => recovery.changes),
      ).pipe(
        Stream.map((state) => worktreeRecovery(state, recoveryKey(scope))),
      ),
    ),
);

const retryStaleBatch = Atom.family(
  (selection: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    key: string;
  }) =>
    recoveryRuntime(selection.connection).fn(
      Effect.fn('Changes.retryStaleDiff')(function* (
        query: ReturnType<typeof readChangeDiffs>,
        get: Atom.FnContext,
      ) {
        const recovery = yield* ChangedDiffRecovery;
        yield* Effect.yieldNow;
        const marked = yield* recovery.retry(recoveryKey(selection.scope), [
          selection.key,
        ]);
        if (marked.length > 0) get.refresh(query);
      }),
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
    const requests = diffBatches(
      selection.expectedFiles,
      selection.selections,
      DIFFS_PER_REQUEST,
    ).map((batch) => {
      const input = {
        expectedStatusToken: statusToken,
        expectedFiles: batch.expectedFiles,
        selections: batch.selections,
      };
      const key = JSON.stringify(input);
      return {
        key,
        query: readChangeDiffs({ connection, scope, input }),
        retry: retryStaleBatch({ connection, scope, key }),
      };
    });
    const queries = requests.map((request) => request.query);
    const batches = readDiffBatches(queries);
    const window = readCompleteDiffWindow(queries);
    const recover = readCurrentDiffObservation({ connection, scope });
    return Atom.readable(
      (get) => {
        get.mount(recover);
        for (const request of requests) get.mount(request.retry);
        const results = get(batches);
        const recovery = get(readWorktreeRecovery({ connection, scope }));
        const stale = requests.filter((_, index) => {
          const result = results[index];
          return (
            result !== undefined &&
            AsyncResult.isFailure(result) &&
            isStaleChangeObservation(Cause.squash(result.cause))
          );
        });
        const step = AsyncResult.isSuccess(recovery)
          ? diffRecoveryStep(
              recovery.value,
              read,
              stale.map((request) => request.key),
            )
          : ({ kind: 'idle' } as const);
        if (step.kind === 'recover') get.set(recover, read);
        if (step.kind === 'retry')
          for (const request of stale)
            if (step.batches.includes(request.key))
              get.set(request.retry, request.query);
        return {
          result: get(window),
          recovery: { pending: recoveryPending(step) },
        };
      },
      (refresh) => refresh(batches),
    ).pipe(Atom.setIdleTTL(0));
  },
);
