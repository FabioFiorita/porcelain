import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import {
  ChangedDiffRecovery,
  recoveryKey,
  recoveryRuntime,
} from '../store/recovery.ts';
import { readChanges } from './changes.ts';

export const readCurrentDiffObservation = Atom.family(
  (selection: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    recoveryRuntime(selection.connection).fn(
      Effect.fn('Changes.recoverDiffs')(function* (
        read: number,
        get: Atom.FnContext,
      ) {
        const recovery = yield* ChangedDiffRecovery;
        const key = recoveryKey(selection.scope);
        if (!(yield* recovery.begin(key, read))) return;
        const query = readChanges(selection);
        get.refresh(query);
        yield* Effect.raceFirst(
          recovery.produced(key),
          get
            .result(query, { suspendOnWaiting: true })
            .pipe(Effect.andThen(Effect.never)),
        ).pipe(Effect.ensuring(recovery.finish(key)));
      }),
      { concurrent: true },
    ),
);
