import { it } from '@effect/vitest';
import { expect } from 'vitest';
import { Cause, Deferred, Effect, Exit, Fiber } from 'effect';
import { createWriteQueue, createScopedWriteQueues } from './write-queue.ts';
import { ConnectionError } from '@porcelain/client/transport';

it.effect(
  'starts the next write only after the preceding write completes',
  () =>
    Effect.gen(function* () {
      const queue = createWriteQueue();
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
      const queue = createWriteQueue();
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

it.effect('isolates owners and scopes while sharing equivalent keys', () =>
  Effect.gen(function* () {
    const queues = createScopedWriteQueues();
    const firstOwner = {};
    const secondOwner = {};
    const failure = new ConnectionError({ message: 'First worktree failed' });
    const failed = yield* Effect.forkChild(
      Effect.exit(
        queues(firstOwner, ['comments', 'tree-one']).enqueue(
          Effect.fail(failure),
        ),
      ),
      { startImmediately: true },
    );
    const blocked = yield* Effect.forkChild(
      Effect.exit(
        queues(firstOwner, ['comments', 'tree-one']).enqueue(
          Effect.succeed('should not run'),
        ),
      ),
      { startImmediately: true },
    );
    const otherTree = yield* Effect.forkChild(
      queues(firstOwner, ['comments', 'tree-two']).enqueue(
        Effect.succeed('other tree'),
      ),
      { startImmediately: true },
    );
    const otherOwner = yield* Effect.forkChild(
      queues(secondOwner, ['comments', 'tree-one']).enqueue(
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
  }),
);

it.effect('reports a drain once after the last queued write settles', () =>
  Effect.gen(function* () {
    let drains = 0;
    const queue = createWriteQueue(() => {
      drains += 1;
    });
    const gate = Deferred.makeUnsafe<void>();
    const first = yield* Effect.forkChild(
      queue.enqueue(Effect.succeed('saved')),
      { startImmediately: true },
    );
    const second = yield* Effect.forkChild(
      Effect.exit(
        queue.enqueue(
          Deferred.await(gate).pipe(
            Effect.andThen(
              Effect.fail(new ConnectionError({ message: 'Refused' })),
            ),
          ),
        ),
      ),
      { startImmediately: true },
    );
    expect(yield* Fiber.join(first)).toBe('saved');
    expect(drains).toBe(0);
    yield* Deferred.succeed(gate, undefined);
    expect(yield* Fiber.join(second)).toEqual(
      Exit.fail(new ConnectionError({ message: 'Refused' })),
    );
    expect(drains).toBe(1);
    expect(yield* queue.enqueue(Effect.succeed('retry'))).toBe('retry');
    expect(drains).toBe(2);
  }),
);

it.effect(
  'serializes retained scope handles after their earlier queue drains',
  () =>
    Effect.gen(function* () {
      const queues = createScopedWriteQueues();
      const owner = {};
      const retained = queues(owner, ['comments', 'tree']);
      expect(yield* retained.enqueue(Effect.succeed('initial write'))).toBe(
        'initial write',
      );
      const reopened = queues(owner, ['comments', 'tree']);
      const gate = Deferred.makeUnsafe<void>();
      const started = Deferred.makeUnsafe<void>();
      const steps: string[] = [];
      const first = yield* Effect.forkChild(
        retained.enqueue(
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
        reopened.enqueue(Effect.sync(() => steps.push('reopened started'))),
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
      const queue = createWriteQueue();
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
