import { expect, it } from '@effect/vitest';
import { Cause, Deferred, Effect, Fiber, Exit } from 'effect';
import { TestClock } from 'effect/testing';
import { nativeOperation } from '@porcelain/effects';
import { Lanes } from './lanes.ts';
import { LaneOptions } from '../ports/lane-options.ts';

const options = {
  deadlineMs: 1000,
  readCapacity: 2,
  consistency: { execute: () => Effect.void },
};

it.effect(
  'background failure is settled once and close waits for its durable recovery',
  () =>
    Effect.gen(function* () {
      const subject = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const started = yield* Deferred.make<void>();
      const recovered = yield* Deferred.make<void>();
      const error = new Error('Git failed');
      const failures: unknown[] = [];
      yield* subject.background(
        'repository',
        () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.fail(error)),
          ),
        (cause) =>
          subject.finish('repository', () =>
            Effect.sync(() => {
              failures.push(Cause.squash(cause));
            }).pipe(Effect.andThen(Deferred.succeed(recovered, undefined))),
          ),
      );
      yield* Deferred.await(started);
      yield* Deferred.await(recovered);
      yield* Effect.promise(() => subject.close());
      expect(failures).toEqual([error]);
    }),
);

it.effect(
  'close waits for native cleanup before durable interruption can acquire the same lane',
  () =>
    Effect.gen(function* () {
      const subject = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      const cleanup = Promise.withResolvers<void>();
      const order: string[] = [];
      yield* subject.background(
        'repository',
        () =>
          nativeOperation((signal) => {
            signal.addEventListener('abort', () => aborted.resolve(), {
              once: true,
            });
            started.resolve();
            return cleanup.promise.then(() => {
              order.push('cleanup');
            });
          }),
        () =>
          subject.finish('repository', () =>
            Effect.sync(() => {
              order.push('interrupted');
            }),
          ),
      );
      yield* Effect.promise(() => started.promise);
      let closed = false;
      const closing = subject.close().then(() => {
        closed = true;
      });
      yield* Effect.promise(() => aborted.promise);
      expect(order).toEqual([]);
      expect(closed).toBe(false);
      cleanup.resolve();
      yield* Effect.promise(() => closing);
      expect(order).toEqual(['cleanup', 'interrupted']);
      expect(closed).toBe(true);
    }),
);

it.effect('finish claims handed over before and during close are drained', () =>
  Effect.gen(function* () {
    const subject = Effect.runSync(
      Lanes.pipe(
        Effect.provide(Lanes.layer),
        Effect.provideService(LaneOptions, options),
      ),
    );
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const recorded: string[] = [];
    const before = yield* Effect.forkChild(
      subject.finish('first', () =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.andThen(
            Effect.sync(() => {
              recorded.push('before close');
            }),
          ),
        ),
      ),
    );
    yield* Deferred.await(started);
    const closing = subject.close();
    const after = yield* Effect.forkChild(
      subject.finish('second', () =>
        Effect.sync(() => {
          recorded.push('after close');
        }),
      ),
    );
    yield* Effect.yieldNow;
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.joinAll([before, after]);
    yield* Effect.promise(() => closing);
    expect(recorded.toSorted()).toEqual(['after close', 'before close']);
  }),
);

it.effect(
  'an unqueued custom deadline refuses the caller and still waits for owned cleanup at close',
  () =>
    Effect.gen(function* () {
      const subject = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<string>();
      const task = yield* Effect.forkChild(
        subject.unqueued(
          () =>
            nativeOperation(() => {
              started.resolve();
              return release.promise;
            }),
          { deadlineMs: 5 },
        ),
      );
      yield* Effect.promise(() => started.promise);
      yield* TestClock.adjust(5);
      const exit = yield* Fiber.await(task);
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
        name: 'TimeoutError',
      });
      let closed = false;
      const closing = subject.close().then(() => {
        closed = true;
      });
      yield* Effect.yieldNow;
      expect(closed).toBe(false);
      release.resolve('late');
      yield* Effect.promise(() => closing);
      expect(closed).toBe(true);
    }),
);

it.effect(
  'a queued writer takes precedence over a queued read after the admitted reads drain',
  () =>
    Effect.gen(function* () {
      const lanes = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => lanes.close()));
      const holding = yield* Deferred.make<void>();
      const firstStarted = yield* Deferred.make<void>();
      const secondStarted = yield* Deferred.make<void>();
      const order: string[] = [];
      const first = yield* Effect.forkChild(
        lanes.run('repo', 'read', () =>
          Deferred.succeed(firstStarted, undefined).pipe(
            Effect.andThen(Deferred.await(holding)),
          ),
        ),
      );
      const second = yield* Effect.forkChild(
        lanes.run('repo', 'read', () =>
          Deferred.succeed(secondStarted, undefined).pipe(
            Effect.andThen(Deferred.await(holding)),
          ),
        ),
      );
      yield* Deferred.await(firstStarted);
      yield* Deferred.await(secondStarted);
      const queuedRead = yield* Effect.forkChild(
        lanes.run('repo', 'read', () =>
          Effect.sync(() => {
            order.push('read');
          }),
        ),
      );
      yield* Effect.yieldNow;
      const queuedWrite = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          Effect.sync(() => {
            order.push('write');
          }),
        ),
      );
      yield* Effect.yieldNow;
      yield* Deferred.succeed(holding, undefined);
      yield* Fiber.joinAll([first, second, queuedRead, queuedWrite]);
      expect(order).toEqual(['write', 'read']);
    }),
);

it.effect(
  'a deadline answers before uncooperative IO settles but keeps the lane until cleanup',
  () =>
    Effect.gen(function* () {
      const lanes = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => lanes.close()));
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      const native = Promise.withResolvers<string>();
      let followers = 0;
      const first = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          nativeOperation((signal) => {
            signal.addEventListener('abort', () => aborted.resolve(), {
              once: true,
            });
            started.resolve();
            return native.promise;
          }),
        ),
      );
      yield* Effect.promise(() => started.promise);
      const second = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          Effect.sync(() => {
            followers += 1;
            return 'second';
          }),
        ),
      );
      yield* TestClock.adjust(1000);
      const expired = yield* Fiber.await(first);
      expect(
        Exit.isFailure(expired) && Cause.squash(expired.cause),
      ).toMatchObject({ name: 'TimeoutError' });
      yield* Effect.promise(() => aborted.promise);
      expect(followers).toBe(0);
      native.resolve('late');
      expect(yield* Fiber.join(second)).toBe('second');
      expect(followers).toBe(1);
    }),
);

it.effect('cancelling a queued read removes its admission', () =>
  Effect.gen(function* () {
    const lanes = Effect.runSync(
      Lanes.pipe(
        Effect.provide(Lanes.layer),
        Effect.provideService(LaneOptions, options),
      ),
    );
    yield* Effect.addFinalizer(() => Effect.promise(() => lanes.close()));
    const holding = yield* Deferred.make<void>();
    const started = yield* Deferred.make<void>();
    let reads = 0;
    const writer = yield* Effect.forkChild(
      lanes.run('repo', 'write', () =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(holding)),
        ),
      ),
    );
    yield* Deferred.await(started);
    const cancelled = yield* Effect.forkChild(
      lanes.run('repo', 'read', () =>
        Effect.sync(() => {
          reads += 1;
        }),
      ),
    );
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(cancelled);
    yield* Deferred.succeed(holding, undefined);
    yield* Fiber.join(writer);
    expect(reads).toBe(0);
    expect(
      yield* lanes.run('repo', 'write', () => Effect.succeed('available')),
    ).toBe('available');
  }),
);

it.effect('runs completion after the writer releases the lane', () =>
  Effect.gen(function* () {
    const lanes = Effect.runSync(
      Lanes.pipe(
        Effect.provide(Lanes.layer),
        Effect.provideService(LaneOptions, options),
      ),
    );
    const order: string[] = [];
    const result = yield* lanes.commit(
      'mutation',
      () =>
        Effect.sync(() => {
          order.push('committed');
          return 'saved';
        }),
      (saved) =>
        lanes.run('mutation', 'read', () =>
          Effect.sync(() => {
            order.push(`published:${saved}`);
          }),
        ),
    );
    expect(result).toBe('saved');
    expect(order).toEqual(['committed', 'published:saved']);
    yield* Effect.promise(() => lanes.close());
  }),
);

it.effect(
  'caller cancellation cannot discard completion after a mutation succeeds',
  () =>
    Effect.gen(function* () {
      const lanes = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const committed = yield* Deferred.make<void>();
      const completion = yield* Deferred.make<void>();
      const enteredCompletion = yield* Deferred.make<void>();
      const order: string[] = [];
      const caller = yield* Effect.forkChild(
        lanes.commit(
          'mutation',
          () =>
            Effect.uninterruptible(
              Effect.sync(() => {
                order.push('saved');
              }).pipe(Effect.andThen(Deferred.succeed(committed, undefined))),
            ),
          () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(enteredCompletion, undefined);
              yield* Deferred.await(completion);
              order.push('published');
            }),
        ),
      );
      yield* Deferred.await(committed);
      yield* Deferred.await(enteredCompletion);
      yield* Fiber.interrupt(caller);
      expect(order).toEqual(['saved']);
      const closing = yield* Effect.forkChild(
        Effect.promise(() => lanes.close()),
      );
      expect(order).toEqual(['saved']);
      yield* Deferred.succeed(completion, undefined);
      yield* Fiber.join(closing);
      expect(order).toEqual(['saved', 'published']);
    }),
);

it.effect(
  'an interrupted atomic mutation still publishes its confirmed result after releasing the lane',
  () =>
    Effect.gen(function* () {
      const lanes = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const committing = yield* Deferred.make<void>();
      const committed = yield* Deferred.make<void>();
      const publication = yield* Deferred.make<string>();
      const caller = yield* Effect.forkChild(
        lanes.commit(
          'mutation',
          () =>
            Effect.uninterruptible(
              Effect.gen(function* () {
                yield* Deferred.succeed(committing, undefined);
                yield* Deferred.await(committed);
                return 'saved';
              }),
            ),
          (value) => Deferred.succeed(publication, value).pipe(Effect.asVoid),
        ),
      );

      yield* Deferred.await(committing);
      yield* Fiber.interrupt(caller);
      yield* Deferred.succeed(committed, undefined);
      expect(yield* Deferred.await(publication)).toBe('saved');
      expect(
        yield* lanes.run('mutation', 'read', () => Effect.succeed('available')),
      ).toBe('available');
      yield* Effect.promise(() => lanes.close());
    }),
);

it.effect(
  'cancelling preparation prevents both the transaction commit and its publication',
  () =>
    Effect.gen(function* () {
      const lanes = Effect.runSync(
        Lanes.pipe(
          Effect.provide(Lanes.layer),
          Effect.provideService(LaneOptions, options),
        ),
      );
      const preparing = yield* Deferred.make<void>();
      const stopped = yield* Deferred.make<void>();
      const order: string[] = [];
      const caller = yield* Effect.forkChild(
        lanes.transaction(
          'mutation',
          () =>
            Deferred.succeed(preparing, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.ensuring(Deferred.succeed(stopped, undefined)),
            ),
          () =>
            Effect.sync(() => {
              order.push('committed');
            }),
          () =>
            Effect.sync(() => {
              order.push('published');
            }),
        ),
      );
      yield* Deferred.await(preparing);
      yield* Fiber.interrupt(caller);
      yield* Deferred.await(stopped);
      expect(
        yield* lanes.run('mutation', 'read', () => Effect.succeed('available')),
      ).toBe('available');
      expect(order).toEqual([]);
      yield* Effect.promise(() => lanes.close());
    }),
);

it.effect('a rejected transaction never publishes and releases its lane', () =>
  Effect.gen(function* () {
    const lanes = Effect.runSync(
      Lanes.pipe(
        Effect.provide(Lanes.layer),
        Effect.provideService(LaneOptions, options),
      ),
    );
    const failure = new Error('Commit refused');
    let publications = 0;
    const exit = yield* Effect.exit(
      lanes.transaction(
        'mutation',
        () => Effect.succeed('prepared'),
        () => Effect.fail(failure),
        () =>
          Effect.sync(() => {
            publications += 1;
          }),
      ),
    );
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(failure);
    expect(publications).toBe(0);
    expect(
      yield* lanes.run('mutation', 'read', () => Effect.succeed('available')),
    ).toBe('available');
    yield* Effect.promise(() => lanes.close());
  }),
);

it.effect('admits queued writers in order before later readers', () =>
  Effect.gen(function* () {
    const lanes = yield* Lanes.pipe(
      Effect.provide(Lanes.layer),
      Effect.provideService(LaneOptions, options),
    );
    yield* Effect.addFinalizer(() => Effect.promise(() => lanes.close()));
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const order: string[] = [];
    const holding = yield* Effect.forkChild(
      lanes.run('repo', 'read', () =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
        ),
      ),
    );
    yield* Deferred.await(started);
    const waiting = [];
    for (const name of ['first', 'second', 'third']) {
      waiting.push(
        yield* Effect.forkChild(
          lanes.run('repo', 'write', () =>
            Effect.sync(() => {
              order.push(name);
            }),
          ),
        ),
      );
      yield* Effect.yieldNow;
    }
    const reader = yield* Effect.forkChild(
      lanes.run('repo', 'read', () =>
        Effect.sync(() => {
          order.push('read');
        }),
      ),
    );
    yield* Effect.yieldNow;
    expect(order).toEqual([]);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.joinAll([holding, ...waiting, reader]);
    expect(order).toEqual(['first', 'second', 'third', 'read']);
  }),
);

it.effect(
  'cancelling the first queued writer preserves the next writer and releases its priority after completion',
  () =>
    Effect.gen(function* () {
      const lanes = yield* Lanes.pipe(
        Effect.provide(Lanes.layer),
        Effect.provideService(LaneOptions, options),
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => lanes.close()));
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const order: string[] = [];
      const holding = yield* Effect.forkChild(
        lanes.run('repo', 'read', () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
          ),
        ),
      );
      yield* Deferred.await(started);
      const cancelled = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          Effect.sync(() => {
            order.push('cancelled');
          }),
        ),
      );
      yield* Effect.yieldNow;
      const next = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          Effect.sync(() => {
            order.push('write');
          }),
        ),
      );
      yield* Effect.yieldNow;
      const reader = yield* Effect.forkChild(
        lanes.run('repo', 'read', () =>
          Effect.sync(() => {
            order.push('read');
          }),
        ),
      );
      yield* Fiber.interrupt(cancelled);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.joinAll([holding, next, reader]);
      expect(order).toEqual(['write', 'read']);
    }),
);
