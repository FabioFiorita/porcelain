import { Effect } from 'effect';
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
  return runtime
    .atom(
      Effect.gen(function* () {
        const subscriptions = yield* ReadSubscriptions;
        yield* subscriptions.retain({ ...scope, paths });
        const result = yield* read;
        yield* currentAnswerEffect(connection.request().signal);
        return result;
      }),
    )
    .pipe(
      connection.atoms.withReactivity([
        queryKeys.environment(connection.environmentId),
        queryKeys.review(connection.environmentId, scope),
        queryKeys.reviewSurface(
          connection.environmentId,
          scope,
          surface.slice(0, 1),
        ),
        queryKeys.reviewSurface(connection.environmentId, scope, surface),
      ]),
      Atom.setIdleTTL(0),
    );
}
