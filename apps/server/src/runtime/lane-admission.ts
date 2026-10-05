import { Effect, TxQueue, TxRef, TxSemaphore } from 'effect';

export function makeLaneAdmission(capacity: number) {
  return Effect.gen(function* () {
    const permits = yield* TxSemaphore.make(capacity);
    const writers = yield* TxQueue.unbounded<number>();
    const sequence = yield* TxRef.make(0);
    return { capacity, permits, writers, sequence };
  });
}

type LaneAdmission = Effect.Success<ReturnType<typeof makeLaneAdmission>>;

export function withLaneAdmission<A, E, R>(
  lane: LaneAdmission,
  mode: 'read' | 'write',
  work: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  return Effect.uninterruptibleMask((restore) => {
    if (mode === 'read') {
      const acquire = Effect.gen(function* () {
        if ((yield* TxQueue.size(lane.writers)) > 0)
          return yield* Effect.txRetry;
        yield* TxSemaphore.acquire(lane.permits);
      }).pipe(Effect.tx);
      return Effect.acquireUseRelease(
        restore(acquire),
        () => restore(work),
        () => TxSemaphore.release(lane.permits),
      );
    }
    const enqueue = Effect.gen(function* () {
      const ticket = yield* TxRef.modify(lane.sequence, (value) => [
        value,
        value + 1,
      ]);
      yield* TxQueue.offer(lane.writers, ticket);
      return ticket;
    }).pipe(Effect.tx);
    return Effect.acquireUseRelease(
      enqueue,
      (ticket) => {
        const acquire = Effect.gen(function* () {
          if ((yield* TxQueue.peek(lane.writers)) !== ticket)
            return yield* Effect.txRetry;
          yield* TxSemaphore.acquireN(lane.permits, lane.capacity);
        }).pipe(Effect.tx);
        return Effect.acquireUseRelease(
          restore(acquire),
          () => restore(work),
          () => TxSemaphore.releaseN(lane.permits, lane.capacity),
        );
      },
      (ticket) =>
        Effect.gen(function* () {
          const waiting = yield* TxQueue.clear(lane.writers);
          yield* TxQueue.offerAll(
            lane.writers,
            waiting.filter((value) => value !== ticket),
          );
        }).pipe(Effect.tx),
    );
  });
}
