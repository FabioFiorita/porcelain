import { describe, expect, it } from '@effect/vitest';
import { Deferred, Effect, Exit, Fiber } from 'effect';
import { nativeOperation } from './native-operation.ts';

describe('native operation ownership', () => {
  it.effect(
    'aborts native IO but holds release until its cleanup settles',
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const aborted = yield* Deferred.make<void>();
        const native = Promise.withResolvers<string>();
        let released = 0;
        const result = yield* Effect.forkChild(
          nativeOperation((signal) => {
            signal.addEventListener(
              'abort',
              () => Deferred.doneUnsafe(aborted, Effect.void),
              {
                once: true,
              },
            );
            Deferred.doneUnsafe(started, Effect.void);
            return native.promise;
          }).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                released += 1;
              }),
            ),
          ),
        );
        yield* Deferred.await(started);
        const stopping = yield* Effect.forkChild(Fiber.interrupt(result));
        yield* Deferred.await(aborted);
        expect(released).toBe(0);
        native.resolve('finished');
        yield* Fiber.join(stopping);
        expect(Exit.hasInterrupts(yield* Fiber.await(result))).toBe(true);
        expect(released).toBe(1);
      }),
  );

  it.effect('preserves successful native values', () =>
    Effect.gen(function* () {
      expect(yield* nativeOperation(() => Promise.resolve('saved'))).toBe(
        'saved',
      );
    }),
  );

  it.effect(
    'settles rejected native work before release after cancellation',
    () =>
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const aborted = yield* Deferred.make<void>();
        const native = Promise.withResolvers<string>();
        let released = 0;
        const result = yield* Effect.forkChild(
          nativeOperation((signal) => {
            signal.addEventListener(
              'abort',
              () => Deferred.doneUnsafe(aborted, Effect.void),
              {
                once: true,
              },
            );
            Deferred.doneUnsafe(started, Effect.void);
            return native.promise;
          }).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                released += 1;
              }),
            ),
          ),
        );
        yield* Deferred.await(started);
        const stopping = yield* Effect.forkChild(Fiber.interrupt(result));
        yield* Deferred.await(aborted);
        expect(released).toBe(0);
        native.reject(new Error('Native cleanup failed'));
        yield* Fiber.join(stopping);
        expect(Exit.hasInterrupts(yield* Fiber.await(result))).toBe(true);
        expect(released).toBe(1);
      }),
  );
});
