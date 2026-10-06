import {
  Context,
  Effect,
  HashMap,
  Layer,
  SubscriptionRef,
  type Scope,
  type Stream,
} from 'effect';

export type ReadSubscription = {
  readonly projectId: string;
  readonly worktreeId: string;
  readonly paths: readonly string[];
};
export type ActiveWorktreeRead = ReadSubscription & {
  readonly surface: string;
  readonly settled: Effect.Effect<void>;
};

export class ReadSubscriptions extends Context.Service<
  ReadSubscriptions,
  {
    readonly snapshot: Effect.Effect<
      HashMap.HashMap<symbol, ActiveWorktreeRead>
    >;
    readonly changes: Stream.Stream<
      HashMap.HashMap<symbol, ActiveWorktreeRead>
    >;
    readonly retain: (
      subscription: ActiveWorktreeRead,
    ) => Effect.Effect<void, never, Scope.Scope>;
  }
>()('@porcelain/client/ReadSubscriptions') {
  static readonly layer = Layer.effect(
    ReadSubscriptions,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make(
        HashMap.empty<symbol, ActiveWorktreeRead>(),
      );
      return {
        snapshot: SubscriptionRef.get(state),
        changes: SubscriptionRef.changes(state),
        retain: Effect.fn('ReadSubscriptions.retain')(function* (
          subscription: ActiveWorktreeRead,
        ) {
          yield* Effect.acquireRelease(
            Effect.gen(function* () {
              const owner: symbol = Symbol();
              yield* SubscriptionRef.update(
                state,
                HashMap.set(owner, subscription),
              );
              return owner;
            }),
            (owner) => SubscriptionRef.update(state, HashMap.remove(owner)),
          );
        }),
      };
    }),
  );
}
