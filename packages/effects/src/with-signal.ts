import { Effect } from 'effect';

export function withSignal<A, E, R>(
  work: Effect.Effect<A, E, R>,
  signal: AbortSignal,
): Effect.Effect<A, E, R> {
  return Effect.suspend(() => {
    if (signal.aborted) return Effect.interrupt;
    const cancelled = Effect.callback<never>((resume) => {
      const abort = () => resume(Effect.interrupt);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      return Effect.sync(() => signal.removeEventListener('abort', abort));
    });
    return Effect.raceFirst(work, cancelled).pipe(
      Effect.flatMap((value) =>
        signal.aborted ? Effect.interrupt : Effect.succeed(value),
      ),
    );
  });
}
