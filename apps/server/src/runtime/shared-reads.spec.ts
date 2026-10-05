import { Deferred, Effect, Exit, Fiber, Scope } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { describe, expect, it } from 'vitest';
import { makeSharedReads } from './shared-reads.ts';

function readGate() {
  const started = Effect.runSync(Deferred.make<void>());
  const release = Effect.runSync(Deferred.make<string>());
  let calls = 0;
  const work = () =>
    Effect.gen(function* () {
      calls += 1;
      yield* Deferred.succeed(started, undefined);
      return yield* Deferred.await(release);
    });
  return { started, release, work, calls: () => calls };
}

describe('SharedReads', () => {
  it('shares only overlapping reads and starts fresh after settlement', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string>().pipe(Scope.provide(scope)),
    );
    const gate = readGate();
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
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
    } finally {
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
  });
  it('lets one caller leave without interrupting the remaining caller', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string>().pipe(Scope.provide(scope)),
    );
    const gate = readGate();
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
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
    } finally {
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
  });
  it('waits for native cleanup when the last caller leaves', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string>().pipe(Scope.provide(scope)),
    );
    const started = Promise.withResolvers<void>();
    const cancelled = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<string>();
    const fiber = Effect.runFork(
      reads.run('same', () =>
        nativeOperation((signal) => {
          signal.addEventListener('abort', () => cancelled.resolve(), {
            once: true,
          });
          started.resolve();
          return cleanup.promise;
        }),
      ),
    );
    await started.promise;
    let left = false;
    const leave = Effect.runPromise(Fiber.interrupt(fiber)).then(() => {
      left = true;
    });
    await cancelled.promise;
    expect(left).toBe(false);
    cleanup.resolve('settled');
    await leave;
    expect(left).toBe(true);
    await Effect.runPromise(Scope.close(scope, Exit.void));
  });
  it('forwards failures and removes the failed group before a new read', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string, Error>().pipe(Scope.provide(scope)),
    );
    const failure = new Error('Failed read');
    try {
      const exit = await Effect.runPromiseExit(
        reads.run('same', () => Effect.fail(failure)),
      );
      expect(Exit.isFailure(exit)).toBe(true);
      await expect(
        Effect.runPromise(
          reads.run('same', () => Effect.succeed('new answer')),
        ),
      ).resolves.toBe('new answer');
    } finally {
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
  });
  it('keeps a replacement read shared after the retired read finishes cancellation cleanup', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string>().pipe(Scope.provide(scope)),
    );
    const started = Promise.withResolvers<void>();
    const cancelled = Promise.withResolvers<void>();
    const cleanup = Promise.withResolvers<string>();
    const gate = readGate();
    try {
      const retired = Effect.runFork(
        reads.run('same', () =>
          nativeOperation((signal) => {
            signal.addEventListener('abort', () => cancelled.resolve(), {
              once: true,
            });
            started.resolve();
            return cleanup.promise;
          }),
        ),
      );
      await started.promise;
      const leaving = Effect.runPromise(Fiber.interrupt(retired));
      await cancelled.promise;
      await Effect.runPromise(
        Effect.gen(function* () {
          const replacement = yield* Effect.forkChild(
            reads.run('same', gate.work),
          );
          yield* Deferred.await(gate.started);
          cleanup.resolve('retired');
          yield* Effect.promise(() => leaving);
          const joining = yield* Effect.forkChild(
            reads.run('same', gate.work),
            { startImmediately: true },
          );
          expect(gate.calls()).toBe(1);
          yield* Deferred.succeed(gate.release, 'replacement');
          expect(yield* Fiber.join(replacement)).toBe('replacement');
          expect(yield* Fiber.join(joining)).toBe('replacement');
        }),
      );
    } finally {
      cleanup.resolve('retired');
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
  });

  it('refuses new reads after its owning scope closes', async () => {
    const scope = await Effect.runPromise(Scope.make());
    const reads = await Effect.runPromise(
      makeSharedReads<string>().pipe(Scope.provide(scope)),
    );
    await Effect.runPromise(Scope.close(scope, Exit.void));
    const result = await Effect.runPromiseExit(
      reads.run('same', () => Effect.succeed('closed')),
    );
    expect(Exit.hasInterrupts(result)).toBe(true);
  });
});
