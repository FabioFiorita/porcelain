import { Deferred, Effect, Exit, Fiber } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { describe, expect, it } from 'vitest';
import { SharedReads } from './shared-reads.ts';

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
    const reads = new SharedReads<string>();
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
      await reads.close();
    }
  });
  it('lets one caller leave without interrupting the remaining caller', async () => {
    const reads = new SharedReads<string>();
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
      await reads.close();
    }
  });
  it('waits for native cleanup when the last caller leaves', async () => {
    const reads = new SharedReads<string>();
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
    await reads.close();
  });
  it('forwards failures and removes the failed group before a new read', async () => {
    const reads = new SharedReads<string, Error>();
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
      await reads.close();
    }
  });
});
