import { Effect, Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection, WorktreeScope } from './connection.ts';
import { queryKeys } from './query-keys.ts';
import { currentAnswerEffect } from './stale-answer.ts';
import { ReadSubscriptions } from './read-subscriptions.ts';

export function worktreeRead<A, E, R>(
  connection: RuntimeConnection,
  scope: WorktreeScope,
  surface: readonly unknown[],
  read: Effect.Effect<A, E, R>,
  runtime: Atom.AtomRuntime<R | ReadSubscriptions>,
  paths: readonly string[] = [],
) {
  return reactiveRead(
    connection,
    scope,
    surface,
    runtime.atom(
      Effect.gen(function* () {
        const subscriptions = yield* ReadSubscriptions;
        yield* subscriptions.retain({ ...scope, paths });
        const result = yield* read;
        yield* currentAnswerEffect(connection.request().signal);
        return result;
      }),
    ),
  );
}

export function worktreePull<A, E, R>(
  connection: RuntimeConnection,
  scope: WorktreeScope,
  surface: readonly unknown[],
  read: Stream.Stream<A, E, R>,
  runtime: Atom.AtomRuntime<R | ReadSubscriptions>,
) {
  return reactiveRead(
    connection,
    scope,
    surface,
    runtime.pull(
      Stream.unwrap(
        Effect.gen(function* () {
          const subscriptions = yield* ReadSubscriptions;
          yield* subscriptions.retain({ ...scope, paths: [] });
          return read;
        }),
      ),
    ),
  );
}

function reactiveRead<A extends Atom.Atom<unknown>>(
  connection: RuntimeConnection,
  scope: WorktreeScope,
  surface: readonly unknown[],
  read: A,
): A {
  return read.pipe(
    connection.atoms.withReactivity(
      queryKeys.worktreeReads(connection, scope, surface),
    ),
    Atom.setIdleTTL(0),
  );
}
