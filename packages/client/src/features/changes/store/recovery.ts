import { Context, Effect, Layer, Stream, SubscriptionRef } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import {
  beginRecovery,
  type DiffRecovery,
  finishRecovery,
  idleDiffRecovery,
  markRetried,
  stampRead,
} from '../rules/diff-recovery.ts';

type RecoveryState = Readonly<Record<string, DiffRecovery>>;

export function recoveryKey(scope: WorktreeScope) {
  return JSON.stringify([scope.projectId, scope.worktreeId]);
}

export function worktreeRecovery(state: RecoveryState, key: string) {
  return state[key] ?? idleDiffRecovery;
}

export class ChangedDiffRecovery extends Context.Service<
  ChangedDiffRecovery,
  {
    readonly changes: Stream.Stream<RecoveryState>;
    readonly stamp: (key: string) => Effect.Effect<number>;
    readonly begin: (key: string, read: number) => Effect.Effect<boolean>;
    readonly produced: (key: string) => Effect.Effect<void>;
    readonly finish: (key: string) => Effect.Effect<void>;
    readonly retry: (
      key: string,
      batches: readonly string[],
    ) => Effect.Effect<readonly string[]>;
  }
>()('@porcelain/client/ChangedDiffRecovery') {
  static readonly layer = Layer.effect(
    ChangedDiffRecovery,
    Effect.gen(function* () {
      const state = yield* SubscriptionRef.make<RecoveryState>({});
      const update = (
        key: string,
        change: (recovery: DiffRecovery) => DiffRecovery,
      ) =>
        SubscriptionRef.update(state, (current) => {
          const recovery = worktreeRecovery(current, key);
          const next = change(recovery);
          return next === recovery ? current : { ...current, [key]: next };
        });
      return {
        changes: SubscriptionRef.changes(state),
        stamp: Effect.fn('ChangedDiffRecovery.stamp')((key: string) =>
          SubscriptionRef.modify(state, (current) => {
            const next = stampRead(worktreeRecovery(current, key));
            return [next.latestRead, { ...current, [key]: next }] as const;
          }),
        ),
        begin: Effect.fn('ChangedDiffRecovery.begin')(
          (key: string, read: number) =>
            SubscriptionRef.modify(state, (current) => {
              const next = beginRecovery(worktreeRecovery(current, key), read);
              return next
                ? ([true, { ...current, [key]: next }] as const)
                : ([false, current] as const);
            }),
        ),
        produced: Effect.fn('ChangedDiffRecovery.produced')((key: string) =>
          SubscriptionRef.changes(state).pipe(
            Stream.filter(
              (current) => worktreeRecovery(current, key).produced.length > 0,
            ),
            Stream.runHead,
            Effect.asVoid,
          ),
        ),
        finish: Effect.fn('ChangedDiffRecovery.finish')((key: string) =>
          update(key, finishRecovery),
        ),
        retry: Effect.fn('ChangedDiffRecovery.retry')(
          (key: string, batches: readonly string[]) =>
            SubscriptionRef.modify(state, (current) => {
              const { recovery, marked } = markRetried(
                worktreeRecovery(current, key),
                batches,
              );
              return marked.length === 0
                ? ([marked, current] as const)
                : ([marked, { ...current, [key]: recovery }] as const);
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
