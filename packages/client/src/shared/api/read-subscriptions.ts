import {
  Context,
  Effect,
  HashMap,
  Layer,
  SubscriptionRef,
  type Scope,
  type Stream,
} from 'effect';

type ReadSubscription = {
  readonly projectId: string;
  readonly worktreeId: string;
  readonly paths: readonly string[];
};
type ActiveWorktreeRead = ReadSubscription & {
  readonly reviewId?: string;
  readonly surface: string;
  readonly settled: Effect.Effect<void>;
};
type PendingReviewRead = {
  readonly projectId?: never;
  readonly worktreeId?: never;
  readonly paths?: never;
  readonly reviewId: string;
  readonly surface: string;
  readonly settled: Effect.Effect<void>;
};
export type ActiveRead = ActiveWorktreeRead | PendingReviewRead;

export class ReadSubscriptions extends Context.Service<
  ReadSubscriptions,
  {
    readonly snapshot: Effect.Effect<HashMap.HashMap<symbol, ActiveRead>>;
    readonly changes: Stream.Stream<HashMap.HashMap<symbol, ActiveRead>>;
    readonly reviewsFor: (
      scope: Pick<ReadSubscription, 'projectId' | 'worktreeId'>,
    ) => Effect.Effect<readonly string[]>;
    readonly retain: (
      subscription: ActiveRead,
    ) => Effect.Effect<void, never, Scope.Scope>;
  }
>()('@porcelain/client/ReadSubscriptions') {
  static readonly layer = Layer.effect(
    ReadSubscriptions,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make(
        HashMap.empty<symbol, ActiveRead>(),
      );
      return {
        snapshot: SubscriptionRef.get(state),
        changes: SubscriptionRef.changes(state),
        reviewsFor: Effect.fn('ReadSubscriptions.reviewsFor')(function* (
          scope: Pick<ReadSubscription, 'projectId' | 'worktreeId'>,
        ) {
          const reads = yield* SubscriptionRef.get(state);
          return [
            ...new Set(
              [...HashMap.values(reads)].flatMap((read) =>
                read.reviewId &&
                (read.projectId === undefined ||
                  (read.projectId === scope.projectId &&
                    read.worktreeId === scope.worktreeId))
                  ? [read.reviewId]
                  : [],
              ),
            ),
          ];
        }),
        retain: Effect.fn('ReadSubscriptions.retain')(function* (
          subscription: ActiveRead,
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
