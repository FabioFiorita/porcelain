import { Atom, Reactivity } from 'effect/reactivity';
import {
  Effect,
  Equal,
  Exit,
  Fiber,
  Layer,
  ManagedRuntime,
  Scope,
} from 'effect';
import { WriteQueues } from './write-queue.ts';
import { ReadSubscriptions } from './read-subscriptions.ts';
import type { RuntimeConnection, WorktreeConnection } from './connection.ts';

export function createWorktreeConnection<R = never>(
  input: Omit<WorktreeConnection, 'request' | 'scope' | 'isClosed'> & {
    timeoutMs: number;
  },
  memoMap: Layer.MemoMap | undefined,
  services: Layer.Layer<R, never>,
) {
  const scope = Scope.makeUnsafe();
  const { timeoutMs, ...context } = input;
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(
      Layer.fresh(WriteQueues.layer),
      Reactivity.layer,
      Layer.fresh(ReadSubscriptions.layer),
      services,
    ),
    { memoMap },
  );
  const atoms = Atom.context({ memoMap: runtime.memoMap });
  let closed = false;
  const closeEffect = Effect.runSync(
    Effect.cached(
      Effect.suspend(() => {
        closed = true;
        return Scope.close(scope, Exit.void).pipe(
          Effect.ensuring(runtime.disposeEffect),
        );
      }).pipe(Effect.uninterruptible),
    ),
  );
  const close = () => {
    closed = true;
    return Effect.runPromise(closeEffect);
  };
  const connection = Equal.byReference<RuntimeConnection<R>>({
    runtime,
    atoms,
    scope,
    isClosed: () => closed || scope.state._tag === 'Closed',
    close,
    ...context,
    request: Effect.fn('Connection.request')(function* <A, E, R>(
      work: Effect.Effect<A, E, R>,
      caller?: Scope.Scope,
    ) {
      if (closed) return yield* Effect.interrupt;
      const request = caller
        ? Effect.acquireUseRelease(
            Effect.forkIn(work, caller),
            Fiber.join,
            Fiber.interrupt,
          )
        : work;
      const fiber = yield* request.pipe(
        Effect.timeoutOrElse({
          duration: timeoutMs,
          orElse: () => Effect.interrupt,
        }),
        Effect.forkIn(scope),
      );
      return yield* Fiber.join(fiber).pipe(
        Effect.ensuring(Fiber.interrupt(fiber)),
        Effect.flatMap((answer) =>
          closed ? Effect.interrupt : Effect.succeed(answer),
        ),
      );
    }),
  });
  return { connection, close, closeEffect };
}
