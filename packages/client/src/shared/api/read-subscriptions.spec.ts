import { sharedMemoConnections } from '../../../spec/kit/client-fixture.ts';
import { Deferred, Effect, HashMap } from 'effect';
import { expect, it } from 'vitest';

import { ReadSubscriptions } from './read-subscriptions.ts';

it('keeps subscriptions scoped to their connection when applications share layer memoization and removes them on close', async () => {
  const { first, second } = sharedMemoConnections();
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
    expect(second.connection.isClosed()).toBe(false);
  } finally {
    await first.close();
    await second.close();
  }
});
