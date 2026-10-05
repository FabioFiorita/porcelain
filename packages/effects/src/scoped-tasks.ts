import { Context, Effect, Exit, Fiber, Scope } from 'effect';

export class ScopedTasks {
  private readonly scope = Scope.makeUnsafe();
  private readonly context: Context.Context<never>;
  private closing: Fiber.Fiber<void> | undefined;

  constructor(context: Context.Context<never> = Context.empty()) {
    this.context = context;
  }

  after(waitMs: number, run: () => void): () => void {
    const fiber = Effect.runSyncWith(this.context)(
      Effect.forkIn(
        Effect.sleep(waitMs).pipe(Effect.andThen(Effect.sync(run))),
        this.scope,
      ),
    );
    return () => {
      Effect.runForkWith(this.context)(Fiber.interrupt(fiber));
    };
  }

  fork<A, E>(work: Effect.Effect<A, E>): Fiber.Fiber<A, E> {
    return Effect.runSyncWith(this.context)(
      Effect.forkIn(work, this.scope, { startImmediately: true }),
    );
  }

  run<A, E>(work: Effect.Effect<A, E>): Promise<A> {
    return Effect.runPromiseWith(this.context)(Fiber.join(this.fork(work)));
  }

  close(): Effect.Effect<void> {
    return Effect.suspend(() => {
      this.closing ??= Effect.runForkWith(this.context)(
        Scope.close(this.scope, Exit.void),
      );
      return Fiber.join(this.closing);
    });
  }
}
