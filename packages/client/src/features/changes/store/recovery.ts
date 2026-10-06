import { Context, Effect, Layer, type Stream, SubscriptionRef } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type RecoveryState = {
  readonly attempted: Readonly<Record<string, string>>;
  readonly pending: Readonly<Record<string, string>>;
};
export class ChangedDiffRecovery extends Context.Service<
  ChangedDiffRecovery,
  {
    readonly state: Effect.Effect<RecoveryState>;
    readonly changes: Stream.Stream<RecoveryState>;
    readonly begin: (key: string, token: string) => Effect.Effect<boolean>;
    readonly finish: (key: string, token: string) => Effect.Effect<void>;
  }
>()('@porcelain/client/ChangedDiffRecovery') {
  static readonly layer = Layer.effect(
    ChangedDiffRecovery,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<RecoveryState>({
        attempted: {},
        pending: {},
      });
      return {
        state: SubscriptionRef.get(state),
        changes: SubscriptionRef.changes(state),
        begin: Effect.fn('ChangedDiffRecovery.begin')(
          (key: string, token: string) =>
            SubscriptionRef.modify(state, (current) =>
              current.attempted[key] === token
                ? ([false, current] as const)
                : ([
                    true,
                    {
                      attempted: { ...current.attempted, [key]: token },
                      pending: { ...current.pending, [key]: token },
                    },
                  ] as const),
            ),
        ),
        finish: Effect.fn('ChangedDiffRecovery.finish')(
          (key: string, token: string) =>
            SubscriptionRef.update(state, (current) => {
              if (current.pending[key] !== token) return current;
              const pending = { ...current.pending };
              delete pending[key];
              return { ...current, pending };
            }),
        ),
      };
    }),
  );
}
export const recoveryRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      ChangedDiffRecovery.layer,
      get(clientRuntime(connection).layer),
    ),
  ),
);
