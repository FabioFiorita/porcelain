import { it } from '@effect/vitest';
import { expect } from 'vitest';
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Scope,
} from 'effect';
import { WriteQueue, WriteQueues } from './write-queue.ts';
import {
  ConnectionError,
  createWorktreeConnection,
} from '@porcelain/client/transport';

it.effect(
  'starts the next write only after the preceding write completes',
  () =>
    Effect.gen(function* () {
      const queue = yield* WriteQueue.make;
      const gate = Deferred.makeUnsafe<void>();
      const started = Deferred.makeUnsafe<void>();
      const steps: string[] = [];
      const first = yield* Effect.forkChild(
        queue.enqueue(
          Effect.gen(function* () {
            steps.push('first started');
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(gate);
            steps.push('first completed');
            return 'first';
          }),
        ),
        { startImmediately: true },
      );
      const second = yield* Effect.forkChild(
        queue.enqueue(
          Effect.sync(() => {
            steps.push('second started');
            return 'second';
          }),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      expect(steps).toEqual(['first started']);
      yield* Deferred.succeed(gate, undefined);
      expect(yield* Fiber.join(first)).toBe('first');
      expect(yield* Fiber.join(second)).toBe('second');
      expect(steps).toEqual([
        'first started',
        'first completed',
        'second started',
      ]);
    }),
);

it.effect(
  'rejects already queued writes with the original failure and allows a later explicit retry',
  () =>
    Effect.gen(function* () {
      const queue = yield* WriteQueue.make;
      const failure = new ConnectionError({
        message: 'The file changed since it was shown.',
      });
      const started: string[] = [];
      const first = yield* Effect.forkChild(
        Effect.exit(queue.enqueue(Effect.fail(failure))),
        { startImmediately: true },
      );
      const second = yield* Effect.forkChild(
        Effect.exit(queue.enqueue(Effect.sync(() => started.push('second')))),
        { startImmediately: true },
      );
      const third = yield* Effect.forkChild(
        Effect.exit(queue.enqueue(Effect.sync(() => started.push('third')))),
        { startImmediately: true },
      );
      expect(yield* Fiber.join(first)).toEqual(Exit.fail(failure));
      const secondExit = yield* Fiber.join(second);
      const thirdExit = yield* Fiber.join(third);
      expect(
        Exit.isFailure(secondExit) ? Cause.squash(secondExit.cause) : null,
      ).toMatchObject({
        name: 'WriteNotSentError',
        message: 'An earlier change failed, so this one was not sent.',
        cause: failure,
      });
      expect(
        Exit.isFailure(thirdExit) ? Cause.squash(thirdExit.cause) : null,
      ).toMatchObject({ cause: failure });
      expect(started).toEqual([]);
      expect(yield* queue.enqueue(Effect.succeed('explicit retry'))).toBe(
        'explicit retry',
      );
    }),
);

it.effect(
  'isolates connection runtimes and scopes while sharing equivalent keys',
  () =>
    Effect.gen(function* () {
      const queues = Context.get(
        yield* Layer.build(WriteQueues.layer),
        WriteQueues,
      );
      const otherQueues = Context.get(
        yield* Layer.build(WriteQueues.layer),
        WriteQueues,
      );
      const failure = new ConnectionError({ message: 'First worktree failed' });
      const failed = yield* Effect.forkChild(
        Effect.exit(queues.run(['comments', 'tree-one'], Effect.fail(failure))),
        { startImmediately: true },
      );
      const blocked = yield* Effect.forkChild(
        Effect.exit(
          queues.run(
            ['comments', 'tree-one'],
            Effect.succeed('should not run'),
          ),
        ),
        { startImmediately: true },
      );
      const otherTree = yield* Effect.forkChild(
        queues.run(['comments', 'tree-two'], Effect.succeed('other tree')),
        { startImmediately: true },
      );
      const otherOwner = yield* Effect.forkChild(
        otherQueues.run(
          ['comments', 'tree-one'],
          Effect.succeed('other connection'),
        ),
        { startImmediately: true },
      );
      expect(yield* Fiber.join(failed)).toEqual(Exit.fail(failure));
      const blockedExit = yield* Fiber.join(blocked);
      expect(
        Exit.isFailure(blockedExit) ? Cause.squash(blockedExit.cause) : null,
      ).toMatchObject({ cause: failure });
      expect(yield* Fiber.join(otherTree)).toBe('other tree');
      expect(yield* Fiber.join(otherOwner)).toBe('other connection');
      expect(
        yield* queues.run(
          ['comments', 'tree-one'],
          Effect.succeed('explicit retry'),
        ),
      ).toBe('explicit retry');
    }),
);

it.effect(
  'serializes equivalent native scope keys after their earlier queue drains',
  () =>
    Effect.gen(function* () {
      const queues = Context.get(
        yield* Layer.build(WriteQueues.layer),
        WriteQueues,
      );
      expect(
        yield* queues.run(
          ['comments', 'tree'],
          Effect.succeed('initial write'),
        ),
      ).toBe('initial write');
      const gate = Deferred.makeUnsafe<void>();
      const started = Deferred.makeUnsafe<void>();
      const steps: string[] = [];
      const first = yield* Effect.forkChild(
        queues.run(
          ['comments', 'tree'],
          Effect.gen(function* () {
            steps.push('retained started');
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(gate);
            steps.push('retained finished');
          }),
        ),
        { startImmediately: true },
      );
      const second = yield* Effect.forkChild(
        queues.run(
          ['comments', 'tree'],
          Effect.sync(() => steps.push('reopened started')),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      expect(steps).toEqual(['retained started']);
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.join(first);
      yield* Fiber.join(second);
      expect(steps).toEqual([
        'retained started',
        'retained finished',
        'reopened started',
      ]);
    }),
);

it.effect(
  'keeps a cancelled waiter in order until its predecessor settles',
  () =>
    Effect.gen(function* () {
      const queue = yield* WriteQueue.make;
      const gate = Deferred.makeUnsafe<void>();
      const started = Deferred.makeUnsafe<void>();
      const steps: string[] = [];
      const first = yield* Effect.forkChild(
        queue.enqueue(
          Effect.gen(function* () {
            steps.push('first started');
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(gate);
            steps.push('first finished');
          }),
        ),
        { startImmediately: true },
      );
      const cancelled = yield* Effect.forkChild(
        queue.enqueue(Effect.sync(() => steps.push('cancelled started'))),
        { startImmediately: true },
      );
      const interruption = yield* Effect.forkChild(Fiber.interrupt(cancelled), {
        startImmediately: true,
      });
      const third = yield* Effect.forkChild(
        Effect.exit(
          queue.enqueue(Effect.sync(() => steps.push('third started'))),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      expect(steps).toEqual(['first started']);
      yield* Deferred.succeed(gate, undefined);
      yield* Fiber.join(first);
      yield* Fiber.join(interruption);
      const thirdExit = yield* Fiber.join(third);
      expect(
        Exit.isFailure(thirdExit) ? Cause.squash(thirdExit.cause) : null,
      ).toMatchObject({ name: 'WriteNotSentError' });
      expect(steps).toEqual(['first started', 'first finished']);
      expect(yield* queue.enqueue(Effect.succeed('recovery'))).toBe('recovery');
    }),
);

it.effect(
  'closing the native owner cancels writes and waits for admitted cleanup',
  () =>
    Effect.gen(function* () {
      const owner = yield* Scope.make();
      const context = yield* Layer.build(WriteQueues.layer).pipe(
        Effect.provideService(Scope.Scope, owner),
      );
      const queues = Context.get(context, WriteQueues);
      const started = Deferred.makeUnsafe<void>();
      const cleaning = Deferred.makeUnsafe<void>();
      const drain = Deferred.makeUnsafe<void>();
      const steps: string[] = [];
      const first = yield* Effect.forkChild(
        Effect.exit(
          queues.run(
            ['comments'],
            Effect.gen(function* () {
              steps.push('started');
              yield* Deferred.succeed(started, undefined);
              return yield* Effect.never;
            }).pipe(
              Effect.ensuring(
                Effect.gen(function* () {
                  steps.push('cleaning');
                  yield* Deferred.succeed(cleaning, undefined);
                  yield* Deferred.await(drain);
                  steps.push('cleaned');
                }),
              ),
            ),
          ),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      const second = yield* Effect.forkChild(
        Effect.exit(
          queues.run(
            ['comments'],
            Effect.sync(() => steps.push('follower sent')),
          ),
        ),
        { startImmediately: true },
      );
      const closed = yield* Effect.forkChild(Scope.close(owner, Exit.void), {
        startImmediately: true,
      });
      yield* Deferred.await(cleaning);
      expect(steps).toEqual(['started', 'cleaning']);
      expect(closed.pollUnsafe()).toBeUndefined();
      yield* Deferred.succeed(drain, undefined);
      yield* Fiber.join(closed);
      expect(Exit.isFailure(yield* Fiber.join(first))).toBe(true);
      expect(Exit.isFailure(yield* Fiber.join(second))).toBe(true);
      expect(steps).toEqual(['started', 'cleaning', 'cleaned']);
    }),
);

it('shares an application memo map without sharing connection write admission', async () => {
  const memoMap = Layer.makeMemoMapUnsafe();
  const input = {
    environmentId: 'same-environment',
    transport: () => Promise.resolve(Response.json({})),
    timeoutMs: 1000,
  };
  const first = createWorktreeConnection(input, memoMap, Layer.empty);
  const second = createWorktreeConnection(input, memoMap, Layer.empty);
  const entered = Deferred.makeUnsafe<void>();
  first.connection.runtime.runFork(
    WriteQueues.use((queues) =>
      queues.run(
        ['same-worktree'],
        Effect.gen(function* () {
          yield* Deferred.succeed(entered, undefined);
          return yield* Effect.never;
        }),
      ),
    ),
  );
  try {
    await Effect.runPromise(Deferred.await(entered));
    expect(
      await second.connection.runtime.runPromise(
        WriteQueues.use((queues) =>
          queues.run(['same-worktree'], Effect.succeed('independent write')),
        ),
      ),
    ).toBe('independent write');
    await first.close();
    expect(
      await second.connection.runtime.runPromise(
        WriteQueues.use((queues) =>
          queues.run(['same-worktree'], Effect.succeed('still connected')),
        ),
      ),
    ).toBe('still connected');
    expect(second.connection.request().signal.aborted).toBe(false);
  } finally {
    await first.close();
    await second.close();
  }
});
