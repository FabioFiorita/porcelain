import { Deferred, Effect } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
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
import type { RecoveryRequest } from '../rules/diff-recovery.ts';

export const readCurrentDiffObservation = Atom.family(
  (selection: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    recoveryRuntime(selection.connection).fn(
      Effect.fn('Changes.recoverDiffs')(function* (
        request: RecoveryRequest,
        get: Atom.FnContext,
      ) {
        const recovery = yield* ChangedDiffRecovery;
        const key = recoveryKey(selection.scope);
        if (!(yield* recovery.begin(key, request))) return;
        const query = readChanges(selection);
        const settled = yield* Deferred.make<void>();
        let refreshing = false;
        get.refresh(query);
        yield* Effect.acquireUseRelease(
          Effect.sync(() =>
            get.registry.subscribe(
              query,
              (result) => {
                if (AsyncResult.isInitial(result) || result.waiting)
                  refreshing = true;
                else if (refreshing) Deferred.doneUnsafe(settled, Effect.void);
              },
              { immediate: true },
            ),
          ),
          () => Deferred.await(settled),
          (stop) => Effect.sync(stop),
        ).pipe(Effect.ensuring(recovery.finish(key)));
      }),
      { concurrent: true },
    ),
);
