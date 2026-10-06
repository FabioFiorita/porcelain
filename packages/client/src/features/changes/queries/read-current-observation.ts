import { Effect } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { ChangedDiffRecovery, recoveryRuntime } from '../store/recovery.ts';
import { readChangesSnapshot } from './changes.ts';

export const readCurrentDiffObservation = Atom.family(
  (selection: { connection: RuntimeConnection; scope: WorktreeScope }) =>
    recoveryRuntime(selection.connection).fn(
      Effect.fn('Changes.recoverDiffs')(function* (statusToken: string) {
        const recovery = yield* ChangedDiffRecovery;
        const key = JSON.stringify([
          selection.scope.projectId,
          selection.scope.worktreeId,
        ]);
        if (!(yield* recovery.begin(key, statusToken))) return;
        yield* Effect.ensuring(
          Effect.tap(readChangesSnapshot(selection), () =>
            Reactivity.invalidate([
              queryKeys.reviewSurface(
                selection.connection.environmentId,
                selection.scope,
                ['changes'],
              ),
            ]),
          ),
          recovery.finish(key, statusToken),
        );
      }),
      { concurrent: true },
    ),
);
