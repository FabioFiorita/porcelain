import { describe, expect, it } from '@effect/vitest';
import { Cause, Deferred, Effect, Exit, Fiber, Queue, Scope } from 'effect';
import { makeCoalescedWork } from './coalesced-work.ts';

const held = Effect.fn(function* () {
  const started = yield* Queue.unbounded<Deferred.Deferred<void>>();
  let active = 0;
  let mostAtOnce = 0;
  let runs = 0;
  return {
    next: () => Queue.take(started),
    runs: () => runs,
    mostAtOnce: () => mostAtOnce,
    work: {
      execute: () =>
        Effect.gen(function* () {
          const run = yield* Deferred.make<void>();
          runs += 1;
          active += 1;
          mostAtOnce = Math.max(mostAtOnce, active);
          yield* Queue.offer(started, run);
          yield* Deferred.await(run).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                active -= 1;
              }),
            ),
          );
        }),
    },
  };
});

describe('CoalescedWork', () => {
  it.effect('runs the work once for a single request', () =>
    Effect.gen(function* () {
      const subject = yield* held();
      const refresh = yield* makeCoalescedWork(subject.work);
      const done = yield* Effect.forkChild(refresh.execute());
      yield* Deferred.succeed(yield* subject.next(), undefined);
      yield* Fiber.join(done);
      expect(subject.runs()).toBe(1);
    }),
  );
  it.effect('gives requests made during a run one shared following run', () =>
    Effect.gen(function* () {
      const subject = yield* held();
      const refresh = yield* makeCoalescedWork(subject.work);
      const first = yield* Effect.forkChild(refresh.execute());
      const firstRun = yield* subject.next();
      let laterSettled = 0;
      const later = yield* Effect.forEach([1, 2, 3], () =>
        Effect.forkChild(
          refresh.execute().pipe(
            Effect.tap(
              Effect.sync(() => {
                laterSettled += 1;
              }),
            ),
          ),
          { startImmediately: true },
        ),
      );
      expect(subject.runs()).toBe(1);
      yield* Deferred.succeed(firstRun, undefined);
      yield* Fiber.join(first);
      const following = yield* subject.next();
      expect({ runs: subject.runs(), laterSettled }).toEqual({
        runs: 2,
        laterSettled: 0,
      });
      yield* Deferred.succeed(following, undefined);
      yield* Fiber.joinAll(later);
      expect({
        runs: subject.runs(),
        mostAtOnce: subject.mostAtOnce(),
      }).toEqual({ runs: 2, mostAtOnce: 1 });
    }),
  );
  it.effect(
    'starts a new run for a request made after the last one settled',
    () =>
      Effect.gen(function* () {
        const subject = yield* held();
        const refresh = yield* makeCoalescedWork(subject.work);
        const first = yield* Effect.forkChild(refresh.execute());
        yield* Deferred.succeed(yield* subject.next(), undefined);
        yield* Fiber.join(first);
        const second = yield* Effect.forkChild(refresh.execute());
        yield* Deferred.succeed(yield* subject.next(), undefined);
        yield* Fiber.join(second);
        expect(subject.runs()).toBe(2);
      }),
  );
  it.effect(
    'preserves each failed run and allows a fresh following request',
    () =>
      Effect.gen(function* () {
        const subject = yield* held();
        const refresh = yield* makeCoalescedWork(subject.work);
        const first = yield* Effect.forkChild(Effect.exit(refresh.execute()));
        const firstRun = yield* subject.next();
        const shared = yield* Effect.forkChild(Effect.exit(refresh.execute()), {
          startImmediately: true,
        });
        const failure = new Error('listing failed');
        const again = new Error('listing failed again');
        yield* Deferred.done(firstRun, Exit.die(failure));
        const failed = yield* Fiber.join(first);
        expect(Exit.isFailure(failed) && Cause.squash(failed.cause)).toBe(
          failure,
        );
        yield* Deferred.done(yield* subject.next(), Exit.die(again));
        const sharedFailed = yield* Fiber.join(shared);
        expect(
          Exit.isFailure(sharedFailed) && Cause.squash(sharedFailed.cause),
        ).toBe(again);
        const next = yield* Effect.forkChild(refresh.execute());
        yield* Deferred.succeed(yield* subject.next(), undefined);
        yield* Fiber.join(next);
        expect(subject.runs()).toBe(3);
      }),
  );
  it.effect(
    'lets a cancelled caller leave while shared refresh work continues',
    () =>
      Effect.gen(function* () {
        const subject = yield* held();
        const refresh = yield* makeCoalescedWork(subject.work);
        const cancelled = yield* Effect.forkChild(refresh.execute());
        const firstRun = yield* subject.next();
        const staying = yield* Effect.forkChild(refresh.execute(), {
          startImmediately: true,
        });
        yield* Fiber.interrupt(cancelled);
        expect(Exit.hasInterrupts(yield* Fiber.await(cancelled))).toBe(true);
        yield* Deferred.succeed(firstRun, undefined);
        yield* Deferred.succeed(yield* subject.next(), undefined);
        yield* Fiber.join(staying);
        expect(subject.runs()).toBe(2);
      }),
  );
  it.effect('waits for running cleanup when its owning scope closes', () =>
    Effect.gen(function* () {
      const interrupted = yield* Deferred.make<void>();
      const started = yield* Deferred.make<void>();
      const cleanup = yield* Deferred.make<void>();
      const scope = yield* Scope.make();
      const refresh = yield* makeCoalescedWork({
        execute: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(
              Deferred.succeed(interrupted, undefined).pipe(
                Effect.andThen(Deferred.await(cleanup)),
              ),
            ),
          ),
      }).pipe(Scope.provide(scope));
      const request = yield* Effect.forkChild(refresh.execute());
      yield* Deferred.await(started);
      const closing = yield* Effect.forkChild(Scope.close(scope, Exit.void));
      yield* Deferred.await(interrupted);
      expect(closing.pollUnsafe()).toBeUndefined();
      yield* Deferred.succeed(cleanup, undefined);
      yield* Fiber.join(closing);
      expect(Exit.hasInterrupts(yield* Fiber.await(request))).toBe(true);
    }),
  );
});
