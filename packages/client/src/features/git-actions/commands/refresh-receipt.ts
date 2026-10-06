import { Reactivity } from 'effect/reactivity';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { QueryClient, QueryFilters } from '@tanstack/query-core';
import { Effect, Exit, Fiber } from 'effect';
import { ScopedTasks } from '@porcelain/effects';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { isTerminal } from '../store/operations.ts';
import { receiptQueryFilters } from '../../live/commands/cache-updates.ts';

type Receipt = RunGitActionResponse;

function refreshActiveQueries(client: QueryClient, filters: QueryFilters) {
  return Effect.gen(function* () {
    const active = client
      .getQueryCache()
      .findAll(filters)
      .filter((query) => query.isActive());
    yield* Effect.tryPromise({
      try: () => client.invalidateQueries(filters),
      catch: (cause) =>
        new ConnectionError({
          message: 'Git state refresh was interrupted. Check the action again.',
          cause,
        }),
    });
    yield* Effect.forEach(
      active,
      (query) =>
        Effect.gen(function* () {
          while (
            query.state.isInvalidated &&
            query.state.status === 'success'
          ) {
            yield* Effect.tryPromise({
              try: () => query.fetch(),
              catch: (cause) =>
                new ConnectionError({
                  message:
                    'Git state refresh was interrupted. Check the action again.',
                  cause,
                }),
            }).pipe(Effect.ignore);
            if (query.state.fetchStatus === 'idle') break;
          }
          if (query.state.isInvalidated && query.state.status === 'success')
            return yield* Effect.fail(
              new ConnectionError({
                message:
                  'Git state refresh was interrupted. Check the action again.',
              }),
            );
        }),
      { concurrency: 'unbounded', discard: true },
    );
  });
}

const receiptRefreshes = new WeakMap<
  QueryClient,
  {
    tasks: ScopedTasks;
    pending: Map<string, Fiber.Fiber<void, ConnectionError>>;
  }
>();

export function refreshGitReceipt(
  client: QueryClient,
  environmentId: string,
  receipt: Receipt,
): Effect.Effect<void, ConnectionError, Reactivity.Reactivity> {
  return Effect.gen(function* () {
    if (
      !isTerminal(receipt) ||
      receipt.state === 'rejected' ||
      receipt.state === 'no-change'
    )
      return;
    const reactivity = yield* Reactivity.Reactivity;
    let state = receiptRefreshes.get(client);
    if (!state) {
      state = { tasks: new ScopedTasks(), pending: new Map() };
      receiptRefreshes.set(client, state);
    }
    const key = JSON.stringify([
      environmentId,
      receipt.projectId,
      receipt.worktreeId,
      receipt.requestId,
    ]);
    const existing = state.pending.get(key);
    if (existing) return yield* Fiber.join(existing);
    const refresh = Effect.gen(function* () {
      yield* reactivity.invalidate([queryKeys.inventory(environmentId)]);
      const settled = yield* Effect.forEach(
        receiptQueryFilters(environmentId, receipt),
        (filters) => Effect.exit(refreshActiveQueries(client, filters)),
        { concurrency: 'unbounded' },
      );
      const failed = settled.find(Exit.isFailure);
      if (failed) return yield* Effect.failCause(failed.cause);
    });
    const fiber = state.tasks.fork(refresh);
    state.pending.set(key, fiber);
    const owned = state;
    fiber.addObserver(() => {
      owned.pending.delete(key);
      if (owned.pending.size === 0) {
        receiptRefreshes.delete(client);
        void Effect.runPromise(owned.tasks.close());
      }
    });
    return yield* Fiber.join(fiber);
  });
}
