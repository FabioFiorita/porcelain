import { Cause, Deferred, Effect, Exit, Fiber, Scope } from 'effect';
import { describe, expect, it } from '@effect/vitest';
import { makeSharedReads } from './shared-reads.ts';

const readGate = Effect.fn(function* () {
  const started = yield* Deferred.make<void>();
  const release = yield* Deferred.make<string>();
  let calls = 0;
  const work = () =>
    Effect.gen(function* () {
      calls += 1;
      yield* Deferred.succeed(started, undefined);
      return yield* Deferred.await(release);
    });
  return { started, release, work, calls: () => calls };
});
const cleanupGate = Effect.fn(function* () {
  const started = yield* Deferred.make<void>();
  const cancelled = yield* Deferred.make<void>();
  const cleanup = yield* Deferred.make<void>();
  const work = () =>
    Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Effect.never),
      Effect.ensuring(
        Deferred.succeed(cancelled, undefined).pipe(
          Effect.andThen(Deferred.await(cleanup)),
        ),
      ),
    );
  return { started, cancelled, cleanup, work };
});

describe('SharedReads', () => {
  it.effect(
    'shares only overlapping reads and starts fresh after settlement',
    () =>
      Effect.gen(function* () {
        const reads = yield* makeSharedReads<string>();
        const gate = yield* readGate();
        const first = yield* Effect.forkChild(reads.run('same', gate.work));
        yield* Deferred.await(gate.started);
        const second = yield* Effect.forkChild(reads.run('same', gate.work), {
          startImmediately: true,
        });
        expect(gate.calls()).toBe(1);
        yield* Deferred.succeed(gate.release, 'answer');
        expect(yield* Fiber.join(first)).toBe('answer');
        expect(yield* Fiber.join(second)).toBe('answer');
        expect(yield* reads.run('same', gate.work)).toBe('answer');
        expect(gate.calls()).toBe(2);
      }),
  );
  it.effect(
    'lets one caller leave without interrupting the remaining caller',
    () =>
      Effect.gen(function* () {
        const reads = yield* makeSharedReads<string>();
        const gate = yield* readGate();
        const first = yield* Effect.forkChild(reads.run('same', gate.work));
        yield* Deferred.await(gate.started);
        const second = yield* Effect.forkChild(reads.run('same', gate.work), {
          startImmediately: true,
        });
        yield* Fiber.interrupt(first);
        expect(gate.calls()).toBe(1);
        yield* Deferred.succeed(gate.release, 'still connected');
        expect(yield* Fiber.join(second)).toBe('still connected');
      }),
  );
  it.effect('waits for cleanup when the last caller leaves', () =>
    Effect.gen(function* () {
      const reads = yield* makeSharedReads<string>();
      const gate = yield* cleanupGate();
      const fiber = yield* Effect.forkChild(reads.run('same', gate.work));
      yield* Deferred.await(gate.started);
      const leave = yield* Effect.forkChild(Fiber.interrupt(fiber));
      yield* Deferred.await(gate.cancelled);
      expect(leave.pollUnsafe()).toBeUndefined();
      yield* Deferred.succeed(gate.cleanup, undefined);
      yield* Fiber.join(leave);
      expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true);
    }),
  );
  it.effect(
    'forwards failures and removes the failed group before a new read',
    () =>
      Effect.gen(function* () {
        const reads = yield* makeSharedReads<string>();
        const failure = new Error('Failed read');
        const failed = yield* Effect.exit(
          reads.run('same', () => Effect.die(failure)),
        );
        expect(Exit.isFailure(failed) && Cause.squash(failed.cause)).toBe(
          failure,
        );
        expect(
          yield* reads.run('same', () => Effect.succeed('new answer')),
        ).toBe('new answer');
      }),
  );
  it.effect(
    'keeps a replacement read shared after the retired read finishes cancellation cleanup',
    () =>
      Effect.gen(function* () {
        const reads = yield* makeSharedReads<string>();
        const retiredGate = yield* cleanupGate();
        const gate = yield* readGate();
        const retired = yield* Effect.forkChild(
          reads.run('same', retiredGate.work),
        );
        yield* Deferred.await(retiredGate.started);
        const leaving = yield* Effect.forkChild(Fiber.interrupt(retired));
        yield* Deferred.await(retiredGate.cancelled);
        const replacement = yield* Effect.forkChild(
          reads.run('same', gate.work),
        );
        yield* Deferred.await(gate.started);
        yield* Deferred.succeed(retiredGate.cleanup, undefined);
        yield* Fiber.join(leaving);
        const joining = yield* Effect.forkChild(reads.run('same', gate.work), {
          startImmediately: true,
        });
        expect(gate.calls()).toBe(1);
        yield* Deferred.succeed(gate.release, 'replacement');
        expect(yield* Fiber.join(replacement)).toBe('replacement');
        expect(yield* Fiber.join(joining)).toBe('replacement');
      }),
  );
  it.effect('refuses new reads after its owning scope closes', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const reads = yield* makeSharedReads<string>().pipe(Scope.provide(scope));
      yield* Scope.close(scope, Exit.void);
      expect(
        Exit.hasInterrupts(
          yield* Effect.exit(reads.run('same', () => Effect.succeed('closed'))),
        ),
      ).toBe(true);
    }),
  );
});
