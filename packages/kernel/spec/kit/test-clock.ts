import { DateTime, Effect, Exit, Scope } from 'effect';
import { TestClock } from 'effect/testing';
import { onTestFinished } from 'vitest';

export async function testClock(
  instant: string = '2026-01-01T00:00:00.000Z',
): Promise<TestClock.TestClock> {
  const scope = Effect.runSync(Scope.make());
  onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));
  const clock = await Effect.runPromise(
    TestClock.make().pipe(Effect.provideService(Scope.Scope, scope)),
  );
  await Effect.runPromise(
    clock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(instant))),
  );
  return clock;
}
