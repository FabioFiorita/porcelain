import { Deferred, Effect, HashMap, Layer } from 'effect';
import { expect, it } from 'vitest';
import { createWorktreeConnection } from '@porcelain/client/transport';
import { ReadSubscriptions } from './read-subscriptions.ts';

it('keeps subscriptions scoped to their connection when applications share layer memoization and removes them on close', async () => {
  const memoMap = Layer.makeMemoMapUnsafe();
  const input = {
    environmentId: 'same-environment',
    transport: () => Promise.resolve(Response.json({})),
    timeoutMs: 1000,
  };
  const first = createWorktreeConnection(input, memoMap);
  const second = createWorktreeConnection(input, memoMap);
  const subscribed = Deferred.makeUnsafe<void>();
  const reads = first.connection.runtime.runSync(ReadSubscriptions);
  first.connection.runtime.runFork(
    Effect.scoped(
      Effect.gen(function* () {
        yield* reads.retain({
          projectId: 'project',
          worktreeId: 'worktree',
          paths: ['README.md'],
          surface: 'text',
          settled: Effect.void,
        });
        yield* Deferred.succeed(subscribed, undefined);
        return yield* Effect.never;
      }),
    ),
  );
  try {
    await Effect.runPromise(Deferred.await(subscribed));
    expect(
      await Effect.runPromise(
        Effect.map(reads.snapshot, (state) =>
          [...HashMap.values(state)].map(({ paths, surface }) => ({
            paths,
            surface,
          })),
        ),
      ),
    ).toEqual([{ paths: ['README.md'], surface: 'text' }]);
    expect(
      await second.connection.runtime.runPromise(
        ReadSubscriptions.use((other) =>
          Effect.map(other.snapshot, HashMap.size),
        ),
      ),
    ).toBe(0);
    await first.close();
    expect(
      await Effect.runPromise(Effect.map(reads.snapshot, HashMap.size)),
    ).toBe(0);
    expect(second.connection.request().signal.aborted).toBe(false);
  } finally {
    await first.close();
    await second.close();
  }
});
