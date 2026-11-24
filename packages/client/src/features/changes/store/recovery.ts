import { Context, Effect, Layer, type Stream, SubscriptionRef } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type RecoveryState = {
  readonly attempted: Readonly<Record<string, readonly string[]>>;
  readonly pending: Readonly<Record<string, readonly string[]>>;
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
              current.attempted[key]?.includes(token)
                ? ([false, current] as const)
                : ([
                    true,
                    {
                      attempted: {
                        ...current.attempted,
                        [key]: [...(current.attempted[key] ?? []), token],
                      },
                      pending: {
                        ...current.pending,
                        [key]: [...(current.pending[key] ?? []), token],
                      },
                    },
                  ] as const),
            ),
        ),
        finish: Effect.fn('ChangedDiffRecovery.finish')(
          (key: string, token: string) =>
            SubscriptionRef.update(state, (current) => {
              const tokens = current.pending[key] ?? [];
              if (!tokens.includes(token)) return current;
              const remaining = tokens.filter((pending) => pending !== token);
              const pending = { ...current.pending };
              if (remaining.length === 0) delete pending[key];
              else pending[key] = remaining;
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
