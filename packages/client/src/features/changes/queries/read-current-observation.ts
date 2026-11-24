import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { ChangedDiffRecovery, recoveryRuntime } from '../store/recovery.ts';
import { readChanges } from './changes.ts';

export const readCurrentDiffObservation = Atom.family(
  (selection: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    recoveryRuntime(selection.connection).fn(
      Effect.fn('Changes.recoverDiffs')(function* (
        statusToken: string,
        get: Atom.FnContext,
      ) {
        const recovery = yield* ChangedDiffRecovery;
        const key = JSON.stringify([
          selection.scope.projectId,
          selection.scope.worktreeId,
        ]);
        if (!(yield* recovery.begin(key, statusToken))) return;
        const query = readChanges(selection);
        get.refresh(query);
        return yield* Effect.ensuring(
          get.result(query, { suspendOnWaiting: true }),
          recovery.finish(key, statusToken),
        );
      }),
      { concurrent: true },
    ),
);
