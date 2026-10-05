import { Effect, Exit, Fiber, Scope } from 'effect';
import type { JobRunner } from '../ports/job-runner.ts';

export class CoalescedWork<E> implements JobRunner<E> {
  private readonly work: JobRunner<E>;
  private readonly scope = Scope.makeUnsafe();
  private running: Fiber.Fiber<void, E> | undefined;
  private following: Fiber.Fiber<void, E> | undefined;
  private closing: Promise<void> | undefined;

  constructor(work: JobRunner<E>) {
    this.work = work;
  }

  execute(): Effect.Effect<void, E> {
    return Effect.flatMap(Effect.uninterruptible(this.join()), Fiber.join);
  }

  close(): Promise<void> {
    this.closing ??= Effect.runPromise(Scope.close(this.scope, Exit.void));
    return this.closing;
  }

  private join(): Effect.Effect<Fiber.Fiber<void, E>> {
    return Effect.suspend(() => {
      if (this.following) return Effect.succeed(this.following);
      if (!this.running) return this.start();
      const previous = this.running;
      const following = Effect.exit(Fiber.join(previous)).pipe(
        Effect.andThen(
          Effect.sync(() => {
            this.following = undefined;
          }),
        ),
        Effect.andThen(Effect.flatMap(this.start(), Fiber.join)),
      );
      return Effect.map(Effect.forkIn(following, this.scope), (fiber) => {
        this.following = fiber;
        return fiber;
      });
    });
  }

  private start(): Effect.Effect<Fiber.Fiber<void, E>> {
    return Effect.map(
      Effect.forkIn(
        Effect.suspend(() => this.work.execute()),
        this.scope,
      ),
      (fiber) => {
        this.running = fiber;
        fiber.addObserver(() => {
          if (this.running === fiber) this.running = undefined;
        });
        return fiber;
      },
    );
  }
}
