import { Effect, Fiber, type Duration } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import type { ClosableListener } from '../ports/closable-listener.ts';

export const closeListener = Effect.fn('closeListener')(function* (
  listener: ClosableListener,
  grace: Duration.Duration,
) {
  const deadline = yield* Effect.forkChild(
    Effect.sleep(grace).pipe(
      Effect.andThen(Effect.sync(() => listener.server.closeAllConnections())),
    ),
  );
  yield* nativeOperation(() => Promise.resolve(listener.close())).pipe(
    Effect.ensuring(Fiber.interrupt(deadline)),
  );
});
