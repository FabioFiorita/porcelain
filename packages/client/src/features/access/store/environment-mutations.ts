import { Context, Effect, Layer, Semaphore } from 'effect';
import { AtomRef } from 'effect/reactivity';

export class EnvironmentMutations extends Context.Service<
  EnvironmentMutations,
  {
    readonly pendingSelections: AtomRef.ReadonlyRef<number>;
    readonly run: <A, E, R>(
      group: 'access' | 'selection',
      work: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>;
  }
>()('@porcelain/client/EnvironmentMutations') {
  static readonly layer = Layer.effect(
    EnvironmentMutations,
    Effect.gen(function* () {
      const admission = yield* Semaphore.make(1);
      const pendingSelections = AtomRef.make(0);
      return {
        pendingSelections,
        run: <A, E, R>(
          group: 'access' | 'selection',
          work: Effect.Effect<A, E, R>,
        ) =>
          Effect.acquireUseRelease(
            Effect.sync(() => {
              if (group === 'selection')
                pendingSelections.update((count) => count + 1);
            }),
            () => admission.withPermit(work),
            () =>
              Effect.sync(() => {
                if (group === 'selection')
                  pendingSelections.update((count) => count - 1);
              }),
          ),
      };
    }),
  );
}
