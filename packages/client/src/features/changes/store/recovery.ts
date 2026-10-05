import { Context, Effect, Layer } from 'effect';
import { AtomRef } from 'effect/reactivity';

type RecoveryState = {
  readonly attempted: Readonly<Record<string, string>>;
  readonly pending: Readonly<Record<string, string>>;
};

export class ChangedDiffRecovery extends Context.Service<
  ChangedDiffRecovery,
  {
    readonly state: AtomRef.ReadonlyRef<RecoveryState>;
    readonly begin: (key: string, token: string) => Effect.Effect<boolean>;
    readonly finish: (key: string, token: string) => Effect.Effect<void>;
  }
>()('@porcelain/client/ChangedDiffRecovery') {
  static readonly layer = Layer.effect(
    ChangedDiffRecovery,
    Effect.sync(() => {
      const state = AtomRef.make<RecoveryState>({ attempted: {}, pending: {} });
      return {
        state,
        begin: Effect.fn('ChangedDiffRecovery.begin')(
          (key: string, token: string) =>
            Effect.sync(() => {
              if (state.value.attempted[key] === token) return false;
              state.update((current) => ({
                attempted: { ...current.attempted, [key]: token },
                pending: { ...current.pending, [key]: token },
              }));
              return true;
            }),
        ),
        finish: Effect.fn('ChangedDiffRecovery.finish')(
          (key: string, token: string) =>
            Effect.sync(() => {
              state.update((current) => {
                if (current.pending[key] !== token) return current;
                const pending = { ...current.pending };
                delete pending[key];
                return { ...current, pending };
              });
            }),
        ),
      };
    }),
  );
}
