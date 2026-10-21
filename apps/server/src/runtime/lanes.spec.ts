import { describe } from 'vitest';
import { expect, it } from '@effect/vitest';
import {
  Cause,
  Deferred,
  Effect,
  Fiber,
  Exit,
  Context,
  Layer,
  Scope,
} from 'effect';
import { TestClock } from 'effect/testing';
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
      const subject = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
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
      yield* subject.close();
      expect(failures).toEqual([error]);
    }),
);

it.effect(
  'close waits for native cleanup before durable interruption can acquire the same lane',
  () =>
    Effect.gen(function* () {
      const subject = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
      );
      const started = yield* Deferred.make<void>();
      const aborted = yield* Deferred.make<void>();
      const cleanup = yield* Deferred.make<void>();
      const order: string[] = [];
      yield* subject.background(
        'repository',
        () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(
              Deferred.succeed(aborted, undefined).pipe(
                Effect.andThen(Deferred.await(cleanup)),
                Effect.andThen(
                  Effect.sync(() => {
                    order.push('cleanup');
                  }),
                ),
              ),
            ),
          ),
        () =>
          subject.finish('repository', () =>
            Effect.sync(() => {
              order.push('interrupted');
            }),
          ),
      );
      yield* Deferred.await(started);
      let closed = false;
      const closing = yield* Effect.forkChild(
        subject.close().pipe(
          Effect.tap(
            Effect.sync(() => {
              closed = true;
            }),
          ),
        ),
      );
      yield* Deferred.await(aborted);
      expect(order).toEqual([]);
      expect(closed).toBe(false);
      yield* Deferred.succeed(cleanup, undefined);
      yield* Fiber.join(closing);
      expect(order).toEqual(['cleanup', 'interrupted']);
      expect(closed).toBe(true);
    }),
);

it.effect('finish claims handed over before and during close are drained', () =>
  Effect.gen(function* () {
    const subject = yield* Layer.build(Lanes.layer).pipe(
      Effect.map((context) => Context.get(context, Lanes)),
      Effect.provideService(LaneOptions, options),
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
    const closing = yield* Effect.forkChild(subject.close());
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
    yield* Fiber.join(closing);
    expect(recorded.toSorted()).toEqual(['after close', 'before close']);
  }),
);

it.effect(
  'an unqueued custom deadline refuses the caller and still waits for owned cleanup at close',
  () =>
    Effect.gen(function* () {
      const subject = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
      );
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<string>();
      const task = yield* Effect.forkChild(
        subject.unqueued(
          () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.uninterruptible(Deferred.await(release))),
            ),
          { deadlineMs: 5 },
        ),
      );
      yield* Deferred.await(started);
      yield* TestClock.adjust(5);
      const exit = yield* Fiber.await(task);
      expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
        name: 'TimeoutError',
      });
      let closed = false;
      const closing = yield* Effect.forkChild(
        subject.close().pipe(
          Effect.tap(
            Effect.sync(() => {
              closed = true;
            }),
          ),
        ),
      );
      yield* Effect.yieldNow;
      expect(closed).toBe(false);
      yield* Deferred.succeed(release, 'late');
      yield* Fiber.join(closing);
      expect(closed).toBe(true);
    }),
);

it.effect(
  'a queued writer takes precedence over a queued read after the admitted reads drain',
  () =>
    Effect.gen(function* () {
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
      );
      yield* Effect.addFinalizer(() => lanes.close());
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
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
      );
      yield* Effect.addFinalizer(() => lanes.close());
      const started = yield* Deferred.make<void>();
      const aborted = yield* Deferred.make<void>();
      const native = yield* Deferred.make<string>();
      let followers = 0;
      const first = yield* Effect.forkChild(
        lanes.run('repo', 'write', () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(
              Deferred.succeed(aborted, undefined).pipe(
                Effect.andThen(Deferred.await(native)),
                Effect.asVoid,
              ),
            ),
          ),
        ),
      );
      yield* Deferred.await(started);
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
      yield* Deferred.await(aborted);
      expect(followers).toBe(0);
      yield* Deferred.succeed(native, 'late');
      expect(yield* Fiber.join(second)).toBe('second');
      expect(followers).toBe(1);
    }),
);

it.effect('cancelling a queued read removes its admission', () =>
  Effect.gen(function* () {
    const lanes = yield* Layer.build(Lanes.layer).pipe(
      Effect.map((context) => Context.get(context, Lanes)),
      Effect.provideService(LaneOptions, options),
    );
    yield* Effect.addFinalizer(() => lanes.close());
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
    const lanes = yield* Layer.build(Lanes.layer).pipe(
      Effect.map((context) => Context.get(context, Lanes)),
      Effect.provideService(LaneOptions, options),
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
    yield* lanes.close();
  }),
);

it.effect(
  'caller cancellation cannot discard completion after a mutation succeeds',
  () =>
    Effect.gen(function* () {
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
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
      const closing = yield* Effect.forkChild(lanes.close());
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
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
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
      yield* lanes.close();
    }),
);

it.effect(
  'cancelling preparation prevents both the transaction commit and its publication',
  () =>
    Effect.gen(function* () {
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
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
      yield* lanes.close();
    }),
);

it.effect('a rejected transaction never publishes and releases its lane', () =>
  Effect.gen(function* () {
    const lanes = yield* Layer.build(Lanes.layer).pipe(
      Effect.map((context) => Context.get(context, Lanes)),
      Effect.provideService(LaneOptions, options),
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
    yield* lanes.close();
  }),
);

it.effect('admits queued writers in order before later readers', () =>
  Effect.gen(function* () {
    const lanes = yield* Layer.build(Lanes.layer).pipe(
      Effect.map((context) => Context.get(context, Lanes)),
      Effect.provideService(LaneOptions, options),
    );
    yield* Effect.addFinalizer(() => lanes.close());
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
      const lanes = yield* Layer.build(Lanes.layer).pipe(
        Effect.map((context) => Context.get(context, Lanes)),
        Effect.provideService(LaneOptions, options),
      );
      yield* Effect.addFinalizer(() => lanes.close());
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

it.effect(
  'closing the owning scope drains interrupted recovery before closing lane resources',
  () =>
    Effect.gen(function* () {
      const owner = yield* Scope.make();
      const order: string[] = [];
      const context = yield* Layer.buildWithScope(Lanes.layer, owner).pipe(
        Effect.provideService(LaneOptions, {
          ...options,
          closeResources: () => {
            order.push('resources');
          },
        }),
      );
      const subject = Context.get(context, Lanes);
      const started = yield* Deferred.make<void>();
      const aborted = yield* Deferred.make<void>();
      const cleanup = yield* Deferred.make<void>();
      yield* subject.background(
        'repository',
        () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(
              Deferred.succeed(aborted, undefined).pipe(
                Effect.andThen(Deferred.await(cleanup)),
                Effect.andThen(
                  Effect.sync(() => {
                    order.push('cleanup');
                  }),
                ),
              ),
            ),
          ),
        () =>
          subject.finish('repository', () =>
            Effect.sync(() => {
              order.push('recovered');
            }),
          ),
      );
      yield* Deferred.await(started);
      const closing = yield* Effect.forkChild(Scope.close(owner, Exit.void));
      yield* Deferred.await(aborted);
      expect(order).toEqual([]);
      yield* Deferred.succeed(cleanup, undefined);
      yield* Fiber.join(closing);
      expect(order).toEqual(['cleanup', 'recovered', 'resources']);
    }),
);

const ownerSelections = [
  'P',
  ['P'],
  ['P', 'P'],
  ['P', 'R'],
  ['R', 'P'],
  ['P', 'R', 'P'],
] as const;

const subject = Effect.fnUntraced(function* () {
  return Context.get(
    yield* Layer.build(Lanes.layer).pipe(
      Effect.provideService(LaneOptions, options),
    ),
    Lanes,
  );
});

const gate = Effect.fnUntraced(function* () {
  const release = yield* Deferred.make<void>();
  yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined));
  return release;
});

describe.each(ownerSelections.map((value) => ({ value })))(
  'owner selection %j shares existing admissions once',
  ({ value }) => {
    it.effect('preserves declared ownership', () => {
      const owners = value;
      return Effect.gen(function* () {
        const lanes = yield* subject();
        const release = yield* gate();
        const started = yield* Deferred.make<void>();
        const first = yield* Effect.forkChild(
          lanes.run(owners, 'read', () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
            ),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(started);
        const reads: string[] = [];
        const second = yield* Effect.forkChild(
          lanes.run('P', 'read', () =>
            Effect.sync(() => {
              reads.push('P');
            }),
          ),
          { startImmediately: true },
        );
        expect(
          reads,
          'a duplicate owner must not consume a second read permit',
        ).toEqual(['P']);
        const entered: string[] = [];
        const followers = [];
        for (const key of ['P', 'R', 'Q']) {
          followers.push(
            yield* Effect.forkChild(
              lanes.run(key, 'write', () =>
                Effect.sync(() => {
                  entered.push(key);
                }),
              ),
              { startImmediately: true },
            ),
          );
        }
        expect(entered).toEqual(
          typeof owners === 'string' || owners.every((key) => key === 'P')
            ? ['R', 'Q']
            : ['Q'],
        );
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.joinAll([first, second, ...followers]);
        expect(entered.toSorted()).toEqual(['P', 'Q', 'R']);
      });
    });
  },
);

describe.each(
  (['read', 'write'] as const)
    .flatMap((firstMode) =>
      (['read', 'write'] as const).flatMap((nextMode) =>
        [false, true].map((combinedFirst) => ({
          firstMode,
          nextMode,
          combinedFirst,
        })),
      ),
    )
    .map((value) => ({ value })),
)('conflicts %j', ({ value }) => {
  it.effect('preserves declared ownership', () => {
    const { firstMode, nextMode, combinedFirst } = value;
    return Effect.gen(function* () {
      const lanes = yield* subject();
      const release = yield* gate();
      const started = yield* Deferred.make<void>();
      const first = yield* Effect.forkChild(
        lanes.run(combinedFirst ? ['R', 'P'] : 'P', firstMode, () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
          ),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      let entered = false;
      const next = yield* Effect.forkChild(
        lanes.run(combinedFirst ? 'P' : ['R', 'P'], nextMode, () =>
          Effect.sync(() => {
            entered = true;
          }),
        ),
        { startImmediately: true },
      );
      expect(entered).toBe(firstMode === 'read' && nextMode === 'read');
      expect(
        yield* lanes.run('disjoint', 'write', () => Effect.succeed('free')),
      ).toBe('free');
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.joinAll([first, next]);
      expect(entered).toBe(true);
    });
  });
});

describe.each(
  (['P', 'R'] as const)
    .flatMap((held) =>
      (
        [
          ['P', 'R'],
          ['R', 'P'],
          ['P', 'R', 'P'],
        ] as const
      ).map((owners) => ({ held, owners })),
    )
    .map((value) => ({ value })),
)('queued cancellation %j releases prefix and priority', ({ value }) => {
  it.effect('preserves declared ownership', () => {
    const { held, owners } = value;
    return Effect.gen(function* () {
      const lanes = yield* subject();
      const release = yield* gate();
      const started = yield* Deferred.make<void>();
      const holder = yield* Effect.forkChild(
        lanes.run(held, 'write', () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
          ),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      const calls: string[] = [];
      const caller = yield* Effect.forkChild(
        lanes.run(
          owners,
          'write',
          () =>
            Effect.sync(() => {
              calls.push('work');
            }),
          {
            settled: () =>
              Effect.sync(() => {
                calls.push('settled');
              }),
          },
        ),
        { startImmediately: true },
      );
      const prefix: string[] = [];
      const follower = yield* Effect.forkChild(
        lanes.run('P', 'read', () =>
          Effect.sync(() => {
            prefix.push('read');
          }),
        ),
        { startImmediately: true },
      );
      expect(prefix, 'canonical P must remain held while R is queued').toEqual(
        [],
      );
      yield* Fiber.interrupt(caller);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.joinAll([holder, follower]);
      expect(calls).toEqual([]);
      expect(prefix).toEqual(['read']);
      expect(
        yield* lanes.run(['R', 'P'], 'write', () =>
          Effect.succeed('recovered'),
        ),
      ).toBe('recovered');
    });
  });
});

describe.each((['cancel', 'deadline'] as const).map((value) => ({ value })))(
  '%s keeps every owner until native cleanup ends',
  ({ value }) => {
    it.effect('preserves declared ownership', () => {
      const interruption = value;
      return Effect.gen(function* () {
        const lanes = yield* subject();
        const release = yield* gate();
        const started = yield* Deferred.make<void>();
        const cleaning = yield* Deferred.make<void>();
        const exits: Exit.Exit<string, never>[] = [];
        const caller = yield* Effect.forkChild(
          lanes.run(
            ['R', 'P'],
            'write',
            () =>
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Effect.never),
                Effect.ensuring(
                  Deferred.succeed(cleaning, undefined).pipe(
                    Effect.andThen(Deferred.await(release)),
                  ),
                ),
                Effect.as('archived'),
              ),
            {
              settled: (exit) =>
                Effect.sync(() => {
                  exits.push(exit);
                }),
            },
          ),
        );
        yield* Deferred.await(started);
        const result =
          interruption === 'cancel'
            ? yield* Fiber.interrupt(caller).pipe(
                Effect.andThen(Fiber.await(caller)),
              )
            : yield* TestClock.adjust(1000).pipe(
                Effect.andThen(Fiber.await(caller)),
              );
        expect(Exit.isFailure(result)).toBe(true);
        if (interruption === 'deadline')
          expect(
            Exit.isFailure(result) && Cause.squash(result.cause),
          ).toMatchObject({ name: 'TimeoutError' });
        else
          expect(
            Exit.isFailure(result) && Cause.hasInterrupts(result.cause),
          ).toBe(true);
        yield* Deferred.await(cleaning);
        const entered: string[] = [];
        const followers = [];
        for (const key of ['P', 'R', 'Q'])
          followers.push(
            yield* Effect.forkChild(
              lanes.run(key, 'write', () =>
                Effect.sync(() => {
                  entered.push(key);
                }),
              ),
              { startImmediately: true },
            ),
          );
        expect(
          entered,
          'P and R followers must remain excluded through cleanup',
        ).toEqual(['Q']);
        expect(exits).toEqual([]);
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.joinAll(followers);
        yield* lanes.close();
        expect(entered.toSorted()).toEqual(['P', 'Q', 'R']);
        expect(exits).toHaveLength(1);
        expect(exits[0] && Exit.isFailure(exits[0])).toBe(true);
      });
    });
  },
);

it.effect(
  'the one deadline starts after all owners admit, excluding prefix queue wait',
  () =>
    Effect.gen(function* () {
      const lanes = yield* subject();
      const release = yield* gate();
      const started = yield* Deferred.make<void>();
      const holder = yield* Effect.forkChild(
        lanes.run('R', 'write', () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
          ),
        ),
        { startImmediately: true },
      );
      yield* Deferred.await(started);
      const work = yield* Deferred.make<void>();
      const completed = yield* gate();
      let entered = false;
      const caller = yield* Effect.forkChild(
        lanes.run(
          ['R', 'P'],
          'write',
          () =>
            Deferred.succeed(work, undefined).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  entered = true;
                }),
              ),
              Effect.andThen(Deferred.await(completed)),
              Effect.as('within one budget'),
            ),
          { deadlineMs: 1000 },
        ),
        { startImmediately: true },
      );
      yield* TestClock.adjust(999);
      expect(entered).toBe(false);
      yield* Deferred.succeed(release, undefined);
      yield* Deferred.await(work);
      yield* TestClock.adjust(999);
      yield* Deferred.succeed(completed, undefined);
      expect(yield* Fiber.join(caller)).toBe('within one budget');
      yield* Fiber.join(holder);
    }),
);

describe.each(
  (['none', 'work', 'cleanup', 'both', 'hook'] as const).map((value) => ({
    value,
  })),
)(
  'settlement %s preserves exact causes after every owner releases',
  ({ value }) => {
    it.effect('preserves declared ownership', () => {
      const failure = value;
      return Effect.gen(function* () {
        const lanes = yield* subject();
        const workError = new Error('work sentinel');
        const cleanupError = new Error('cleanup sentinel');
        const hookError = new Error('hook sentinel');
        const seen: Exit.Exit<string, Error>[] = [];
        const reacquired: string[] = [];
        const result = yield* Effect.exit(
          lanes.run(
            ['R', 'P', 'R'],
            'write',
            () =>
              (failure === 'work' || failure === 'both'
                ? Effect.fail(workError)
                : Effect.succeed('saved')
              ).pipe(
                Effect.ensuring(
                  failure === 'cleanup' || failure === 'both'
                    ? Effect.die(cleanupError)
                    : Effect.void,
                ),
              ),
            {
              settled: (exit) =>
                Effect.gen(function* () {
                  seen.push(exit);
                  for (const key of ['P', 'R'])
                    yield* lanes.run(key, 'write', () =>
                      Effect.sync(() => {
                        reacquired.push(key);
                      }),
                    );
                  if (failure === 'hook') return yield* Effect.die(hookError);
                }),
            },
          ),
        );
        expect(reacquired).toEqual(['P', 'R']);
        expect(seen).toHaveLength(1);
        const protectedExit = seen[0];
        if (failure === 'none' || failure === 'hook')
          expect(protectedExit).toEqual(Exit.succeed('saved'));
        else {
          expect(
            protectedExit &&
              Exit.isFailure(protectedExit) &&
              protectedExit.cause.reasons,
          ).toEqual([
            ...(failure === 'work' || failure === 'both'
              ? [Cause.fail(workError).reasons[0]]
              : []),
            ...(failure === 'cleanup' || failure === 'both'
              ? [Cause.die(cleanupError).reasons[0]]
              : []),
          ]);
        }
        if (failure === 'hook')
          expect(Exit.isFailure(result) && Cause.squash(result.cause)).toBe(
            hookError,
          );
        else expect(result).toEqual(protectedExit);
        expect(
          yield* lanes.run(['P', 'R'], 'write', () => Effect.succeed('next')),
        ).toBe('next');
      });
    });
  },
);

it.effect(
  'tuple completion survives late cancellation and shutdown drains it before resources',
  () =>
    Effect.gen(function* () {
      const order: string[] = [];
      const lanes = Context.get(
        yield* Layer.build(Lanes.layer).pipe(
          Effect.provideService(LaneOptions, {
            ...options,
            closeResources: () => {
              order.push('resources');
            },
          }),
        ),
        Lanes,
      );
      const release = yield* gate();
      const completing = yield* Deferred.make<void>();
      const seen: Exit.Exit<string, never>[] = [];
      const caller = yield* Effect.forkChild(
        lanes.run(['P', 'R'], 'write', () => Effect.succeed('saved'), {
          settled: (exit) =>
            Effect.gen(function* () {
              seen.push(exit);
              yield* Deferred.succeed(completing, undefined);
              yield* Deferred.await(release);
              order.push('published');
            }),
        }),
      );
      yield* Deferred.await(completing);
      expect(seen).toEqual([Exit.succeed('saved')]);
      yield* Fiber.interrupt(caller);
      const closing = yield* Effect.forkChild(lanes.close(), {
        startImmediately: true,
      });
      expect(order).toEqual([]);
      const rejected = yield* Effect.exit(
        lanes.run(['P', 'R'], 'read', () => Effect.succeed('unexpected')),
      );
      expect(
        Exit.isFailure(rejected) && Cause.squash(rejected.cause),
      ).toMatchObject({ name: 'ApplicationClosedError' });
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(closing);
      expect(order).toEqual(['published', 'resources']);
    }),
);

describe.each(
  [
    { owners: ['ä', 'Z'] as const, held: 'ä', prefix: 'Z' },
    { owners: ['z', 'A'] as const, held: 'z', prefix: 'A' },
    { owners: ['P', ''] as const, held: 'P', prefix: '' },
  ].map((value) => ({ value })),
)(
  'canonical code-unit order %j holds the prefix until all owners admit',
  ({ value }) => {
    it.effect('preserves declared ownership', () => {
      const { owners, held, prefix } = value;
      return Effect.gen(function* () {
        const lanes = yield* subject();
        const release = yield* gate();
        const started = yield* Deferred.make<void>();
        const holder = yield* Effect.forkChild(
          lanes.run(held, 'write', () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
            ),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(started);
        const calls: string[] = [];
        const combined = yield* Effect.forkChild(
          lanes.run(owners, 'write', () =>
            Effect.sync(() => {
              calls.push('combined');
            }),
          ),
          { startImmediately: true },
        );
        const follower = yield* Effect.forkChild(
          lanes.run(prefix, 'write', () =>
            Effect.sync(() => {
              calls.push('prefix');
            }),
          ),
          { startImmediately: true },
        );
        expect(
          calls,
          'all prefixes stay held while the later owner is queued',
        ).toEqual([]);
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.joinAll([holder, combined, follower]);
        expect(calls).toEqual(['combined', 'prefix']);
      });
    });
  },
);

describe.each((['P', 'R'] as const).map((value) => ({ value })))(
  'tuple writers preserve FIFO and later-reader priority on %s',
  ({ value }) => {
    it.effect('preserves declared ownership', () => {
      const key = value;
      return Effect.gen(function* () {
        const lanes = yield* subject();
        const release = yield* gate();
        const started = yield* Deferred.make<void>();
        const holding = yield* Effect.forkChild(
          lanes.run(key, 'read', () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Deferred.await(release)),
            ),
          ),
          { startImmediately: true },
        );
        yield* Deferred.await(started);
        const order: string[] = [];
        const writers = [];
        for (const name of ['first', 'second', 'third'])
          writers.push(
            yield* Effect.forkChild(
              lanes.run(
                key === 'R' && name !== 'first' ? key : ['R', 'P'],
                'write',
                () =>
                  Effect.sync(() => {
                    order.push(name);
                  }),
              ),
              { startImmediately: true },
            ),
          );
        const reader = yield* Effect.forkChild(
          lanes.run(key, 'read', () =>
            Effect.sync(() => {
              order.push('read');
            }),
          ),
          { startImmediately: true },
        );
        expect(order).toEqual([]);
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.joinAll([holding, ...writers, reader]);
        expect(order).toEqual(['first', 'second', 'third', 'read']);
      });
    });
  },
);

describe.each(
  [
    { operation: 'commit', outcome: 'success' },
    { operation: 'transaction', outcome: 'success' },
    { operation: 'commit', outcome: 'reject' },
    { operation: 'transaction', outcome: 'reject' },
    { operation: 'commit', outcome: 'confirmed-cancel' },
    { operation: 'transaction', outcome: 'confirmed-cancel' },
    { operation: 'transaction', outcome: 'prepare-cancel' },
  ].map((value) => ({ value })),
)('owner-set atomic semantics %j', ({ value }) => {
  it.effect('preserves declared ownership', () => {
    const { operation, outcome } = value;
    return Effect.gen(function* () {
      const lanes = yield* subject();
      const release = yield* gate();
      const entered = yield* Deferred.make<void>();
      const published = yield* Deferred.make<void>();
      const error = new Error('Commit refused');
      const values: string[] = [];
      const prepare = () =>
        outcome === 'prepare-cancel'
          ? Deferred.succeed(entered, undefined).pipe(
              Effect.andThen(Effect.never),
            )
          : Effect.succeed('prepared');
      const write = () =>
        outcome === 'reject'
          ? Effect.fail(error)
          : outcome === 'confirmed-cancel'
            ? Deferred.succeed(entered, undefined).pipe(
                Effect.andThen(Deferred.await(release)),
                Effect.as('saved'),
              )
            : Effect.succeed('saved');
      const notify = (value: string) =>
        Effect.sync(() => {
          values.push(value);
        }).pipe(
          Effect.andThen(Deferred.succeed(published, undefined)),
          Effect.asVoid,
        );
      const caller = yield* Effect.forkChild(
        operation === 'commit'
          ? lanes.commit(['R', 'P', 'R'], write, notify)
          : lanes.transaction(['R', 'P', 'R'], prepare, write, notify),
        { startImmediately: true },
      );
      if (outcome === 'confirmed-cancel' || outcome === 'prepare-cancel') {
        yield* Deferred.await(entered);
        yield* Fiber.interrupt(caller);
        expect(values).toEqual([]);
        yield* Deferred.succeed(release, undefined);
        if (outcome === 'confirmed-cancel') yield* Deferred.await(published);
      }
      const result = yield* Fiber.await(caller);
      if (outcome === 'success') expect(result).toEqual(Exit.succeed('saved'));
      else if (outcome === 'reject')
        expect(Exit.isFailure(result) && Cause.squash(result.cause)).toBe(
          error,
        );
      else
        expect(
          Exit.isFailure(result) && Cause.hasInterrupts(result.cause),
        ).toBe(true);
      expect(
        yield* lanes.run(['P', 'R'], 'read', () =>
          Effect.succeed('reacquired'),
        ),
      ).toBe('reacquired');
      expect(values).toEqual(
        outcome === 'reject' || outcome === 'prepare-cancel' ? [] : ['saved'],
      );
    });
  });
});
