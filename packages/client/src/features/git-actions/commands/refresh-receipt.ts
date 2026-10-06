import { Atom } from 'effect/reactivity';
import {
  Cache,
  Context,
  Data,
  Duration,
  Effect,
  Fiber,
  HashMap,
  Layer,
} from 'effect';
import { Reactivity } from 'effect/reactivity';
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

class Refresh extends Data.Class<RefreshFields> {}

export class GitReceiptRefresh extends Context.Service<
  GitReceiptRefresh,
  {
    readonly refresh: (receipt: RunGitActionResponse) => Effect.Effect<void>;
  }
>()('@porcelain/client/GitReceiptRefresh') {
  static layer(connection: RuntimeConnection) {
    return Layer.effect(
      GitReceiptRefresh,
      Effect.gen(function* () {
        const scope = yield* Effect.scope;
        const reactivity = yield* Reactivity.Reactivity;
        const subscriptions = yield* ReadSubscriptions;
        const cache: Cache.Cache<
          Refresh,
          Fiber.Fiber<void>
        > = yield* Cache.make({
          capacity: Number.POSITIVE_INFINITY,
          timeToLive: Duration.infinity,
          lookup: (receipt: Refresh) =>
            Effect.gen(function* () {
              const surfaces = new Set(
                receiptReadKeys(connection.environmentId, receipt).map((key) =>
                  String(key[4]),
                ),
              );
              const reads = [
                ...HashMap.values(yield* subscriptions.snapshot),
              ].filter(
                (read) =>
                  read.projectId === receipt.projectId &&
                  read.worktreeId === receipt.worktreeId &&
                  surfaces.has(read.surface),
              );
              const fiber = yield* Effect.forkIn(
                Effect.gen(function* () {
                  reactivity.invalidateUnsafe([
                    queryKeys.inventory(connection.environmentId),
                    ...receiptReadKeys(connection.environmentId, receipt),
                  ]);
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
