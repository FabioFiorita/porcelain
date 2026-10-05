import { Effect } from 'effect';

export function nativeOperation<A>(
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A> {
  return Effect.callback((resume, signal) => {
    const pending = work(signal);
    void pending.then(
      (value) => resume(Effect.succeed(value)),
      (cause: unknown) => resume(Effect.die(cause)),
    );
    return Effect.promise(() =>
      pending.then(
        () => undefined,
        () => undefined,
      ),
    );
  });
}
