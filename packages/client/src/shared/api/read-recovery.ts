import { Effect, Layer } from 'effect';
import { Atom, Reactivity } from 'effect/reactivity';
import type { RuntimeConnection, WorktreeScope } from './connection.ts';
import { queryKeys } from './query-keys.ts';

export const retryWorktreeReads = Atom.family((connection: RuntimeConnection) =>
  connection.atoms(Layer.empty).fn((scope: WorktreeScope) =>
    Effect.gen(function* () {
      const reactivity = yield* Reactivity.Reactivity;
      reactivity.invalidateUnsafe([
        queryKeys.review(connection.environmentId, scope),
      ]);
    }),
  ),
);
