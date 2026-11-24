import { Context, Effect, Layer, type Stream, SubscriptionRef } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';

type WorktreeRecovery = {
  readonly latestRead: number;
  readonly refreshedThrough: number;
  readonly refreshing: boolean;
};
type RecoveryState = Readonly<Record<string, WorktreeRecovery>>;

const untouched: WorktreeRecovery = {
  latestRead: 0,
  refreshedThrough: 0,
  refreshing: false,
};

export function recoveryKey(scope: WorktreeScope) {
  return JSON.stringify([scope.projectId, scope.worktreeId]);
}

export function worktreeRecovery(state: RecoveryState, key: string) {
  return state[key] ?? untouched;
}

export class ChangedDiffRecovery extends Context.Service<
  ChangedDiffRecovery,
  {
    readonly state: Effect.Effect<RecoveryState>;
    readonly changes: Stream.Stream<RecoveryState>;
    readonly stamp: (key: string) => Effect.Effect<number>;
    readonly begin: (key: string, read: number) => Effect.Effect<boolean>;
    readonly finish: (key: string) => Effect.Effect<void>;
  }
>()('@porcelain/client/ChangedDiffRecovery') {
  static readonly layer = Layer.effect(
    ChangedDiffRecovery,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<RecoveryState>({});
      const change = (
        current: RecoveryState,
        key: string,
        next: Partial<WorktreeRecovery>,
      ): RecoveryState => ({
        ...current,
        [key]: { ...worktreeRecovery(current, key), ...next },
      });
      return {
        state: SubscriptionRef.get(state),
        changes: SubscriptionRef.changes(state),
        stamp: Effect.fn('ChangedDiffRecovery.stamp')((key: string) =>
          SubscriptionRef.modify(state, (current) => {
            const read = worktreeRecovery(current, key).latestRead + 1;
            return [read, change(current, key, { latestRead: read })] as const;
          }),
        ),
        begin: Effect.fn('ChangedDiffRecovery.begin')(
          (key: string, read: number) =>
            SubscriptionRef.modify(state, (current) => {
              const worktree = worktreeRecovery(current, key);
              if (worktree.refreshing || read <= worktree.refreshedThrough)
                return [false, current] as const;
              return [
                true,
                change(current, key, {
                  refreshedThrough: Math.max(worktree.latestRead, read),
                  refreshing: true,
                }),
              ] as const;
            }),
        ),
        finish: Effect.fn('ChangedDiffRecovery.finish')((key: string) =>
          SubscriptionRef.update(state, (current) =>
            worktreeRecovery(current, key).refreshing
              ? change(current, key, { refreshing: false })
              : current,
          ),
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
