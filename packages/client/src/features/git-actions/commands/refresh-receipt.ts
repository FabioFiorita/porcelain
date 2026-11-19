import { Atom } from 'effect/reactivity';
import {
  Cache,
  Context,
  Data,
  Deferred,
  Duration,
  Effect,
  Fiber,
  HashMap,
  Layer,
} from 'effect';
import { ReadInvalidation } from '../../../shared/api/read-invalidation.ts';
import type { RunGitActionResponse } from '@porcelain/contracts/git-actions';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { ReadSubscriptions } from '../../../shared/api/read-subscriptions.ts';
import { queryKeys } from '../../../shared/api/query-keys.ts';
import { receiptReadKeys } from '../../live/commands/cache-updates.ts';

type RefreshFields = Pick<
  RunGitActionResponse,
  'projectId' | 'worktreeId' | 'requestId' | 'action' | 'state'
>;

type ReceiptPriority = 'action' | 'background';

class Refresh extends Data.Class<
  RefreshFields & { priority: ReceiptPriority }
> {}

export class GitReceiptRefresh extends Context.Service<
  GitReceiptRefresh,
  {
    readonly refresh: (
      receipt: RunGitActionResponse,
      priority?: ReceiptPriority,
    ) => Effect.Effect<void>;
  }
>()('@porcelain/client/GitReceiptRefresh') {
  static layer(connection: RuntimeConnection) {
    return Layer.effect(
      GitReceiptRefresh,
      Effect.gen(function* () {
        const scope = yield* Effect.scope;
        const invalidation = yield* ReadInvalidation;
        const subscriptions = yield* ReadSubscriptions;
        const cache: Cache.Cache<
          Refresh,
          Fiber.Fiber<void>
        > = yield* Cache.make({
          capacity: Number.POSITIVE_INFINITY,
          timeToLive: Duration.infinity,
          lookup: (receipt: Refresh) =>
            Effect.gen(function* () {
              const worktree = receiptReadKeys(
                connection.environmentId,
                receipt,
              );
              const project = queryKeys.projectPullRequests(
                connection.environmentId,
                receipt.projectId,
              );
              const inventory = queryKeys.worktreeInventory(
                connection.environmentId,
              );
              const fiber = yield* Effect.forkIn(
                Effect.gen(function* () {
                  const keys = [inventory, project, ...worktree];
                  if (receipt.priority === 'action') {
                    yield* invalidation.refreshNow(keys);
                  } else {
                    const flushed = yield* invalidation.schedule(keys);
                    yield* Deferred.await(flushed);
                  }
                  const reads = [
                    ...HashMap.values(yield* subscriptions.snapshot),
                  ].filter(
                    (read) =>
                      read.projectId === receipt.projectId &&
                      read.worktreeId === receipt.worktreeId &&
                      (read.surface === 'changes' ||
                        read.surface === 'git-status'),
                  );
                  yield* Effect.forEach(reads, (read) => read.settled, {
                    concurrency: 'unbounded',
                    discard: true,
                  });
                }),
                scope,
              );
              yield* Effect.forkIn(
                Fiber.await(fiber).pipe(
                  Effect.andThen(Cache.invalidate(cache, receipt)),
                ),
                scope,
              );
              return fiber;
            }),
        });
        return {
          refresh: Effect.fn('GitReceiptRefresh.refresh')(function* (
            receipt: RunGitActionResponse,
            priority: ReceiptPriority = 'action',
          ) {
            if (
              receipt.state === 'running' ||
              receipt.state === 'rejected' ||
              receipt.state === 'no-change'
            )
              return;
            const key = new Refresh({
              projectId: receipt.projectId,
              worktreeId: receipt.worktreeId,
              requestId: receipt.requestId,
              action: receipt.action,
              state: receipt.state,
              priority,
            });
            const fiber = yield* Cache.get(cache, key);
            if (fiber.pollUnsafe()) yield* Cache.invalidate(cache, key);
            yield* Fiber.join(fiber);
          }),
        };
      }),
    );
  }
}

export const receiptRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      GitReceiptRefresh.layer(connection),
      get(clientRuntime(connection).layer),
    ),
  ),
);
