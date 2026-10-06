import { type Cause, Effect, Stream } from 'effect';
import { Atom, AtomRegistry, AsyncResult } from 'effect/reactivity';
import type { ConfirmedResource } from './confirmed-resource.ts';
import type { RuntimeConnection, WorktreeScope } from './connection.ts';
import { queryKeys } from './query-keys.ts';
import { currentAnswerEffect } from './stale-answer.ts';
import type { ConnectionError } from './connection-error.ts';
import { ReadSubscriptions } from './read-subscriptions.ts';

export function worktreeRead<A, E, R>(
  connection: RuntimeConnection,
  scope: WorktreeScope,
  surface: readonly unknown[],
  read: Effect.Effect<A, E, R>,
  runtime: Atom.AtomRuntime<R | ReadSubscriptions>,
  paths: readonly string[] = [],
) {
  const atom: Atom.Atom<AsyncResult.AsyncResult<A, E | ConnectionError>> =
    reactiveRead(
      connection,
      scope,
      surface,
      runtime.atom((get) =>
        Effect.gen(function* () {
          const subscriptions = yield* ReadSubscriptions;
          yield* subscriptions.retain({
            ...scope,
            paths,
            surface: String(surface[0]),
            settled: AtomRegistry.getResult(get.registry, atom, {
              suspendOnWaiting: true,
            }).pipe(Effect.ignore, Effect.asVoid),
          });
          const result = yield* read;
          yield* currentAnswerEffect(connection.request().signal);
          return result;
        }),
      ),
    );
  return atom;
}

export function worktreePull<A, E, R>(
  connection: RuntimeConnection,
  scope: WorktreeScope,
  surface: readonly unknown[],
  read: Stream.Stream<A, E, R>,
  runtime: Atom.AtomRuntime<R | ReadSubscriptions>,
) {
  const atom: Atom.Writable<
    Atom.PullResult<A, E | ConnectionError>,
    void
  > = reactiveRead(
    connection,
    scope,
    surface,
    runtime.pull((get) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const subscriptions = yield* ReadSubscriptions;
          yield* subscriptions.retain({
            ...scope,
            paths: [],
            surface: String(surface[0]),
            settled: AtomRegistry.getResult(get.registry, atom, {
              suspendOnWaiting: true,
            }).pipe(Effect.ignore, Effect.asVoid),
          });
          return read;
        }),
      ),
    ),
  );
  return atom;
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

export function worktreeResource<A, E, R>(
  scope: WorktreeScope,
  surface: string,
  resource: Effect.Effect<Pick<ConfirmedResource<A, E>, 'stream'>, never, R>,
  runtime: Atom.AtomRuntime<R | ReadSubscriptions>,
) {
  const atom: Atom.Atom<
    AsyncResult.AsyncResult<A, E | ConnectionError | Cause.NoSuchElementError>
  > = runtime
    .atom((get) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const subscriptions = yield* ReadSubscriptions;
          yield* subscriptions.retain({
            ...scope,
            paths: [],
            surface,
            settled: AtomRegistry.getResult(get.registry, atom, {
              suspendOnWaiting: true,
            }).pipe(Effect.ignore, Effect.asVoid),
          });
          return (yield* resource).stream;
        }),
      ),
    )
    .pipe(
      Atom.map((result) => AsyncResult.flatMap(result, (answer) => answer)),
      Atom.setIdleTTL(0),
    );
  return atom;
}
