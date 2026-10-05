import { Effect, Exit, Fiber, Scope } from 'effect';

type Group<A, E> = { readonly fiber: Fiber.Fiber<A, E>; subscribers: number };

export class SharedReads<A, E = never> {
  private readonly groups = new Map<string, Group<A, E>>();
  private readonly scope = Scope.makeUnsafe();
  private closing: Promise<void> | undefined;

  run(key: string, work: () => Effect.Effect<A, E>): Effect.Effect<A, E> {
    return Effect.acquireUseRelease(
      Effect.gen({ self: this }, function* () {
        if (this.closing !== undefined) return yield* Effect.interrupt;
        let group = this.groups.get(key);
        if (group === undefined) {
          const fiber = yield* Effect.forkIn(Effect.suspend(work), this.scope);
          group = { fiber, subscribers: 0 };
          this.groups.set(key, group);
          const started = group;
          fiber.addObserver(() => {
            if (this.groups.get(key) === started) this.groups.delete(key);
          });
        }
        group.subscribers += 1;
        return group;
      }),
      (group) => Fiber.join(group.fiber),
      (group) =>
        Effect.suspend(() => {
          group.subscribers -= 1;
          if (group.subscribers !== 0) return Effect.void;
          if (this.groups.get(key) === group) this.groups.delete(key);
          return Fiber.interrupt(group.fiber);
        }),
    );
  }

  close(): Promise<void> {
    return (this.closing ??= Effect.runPromise(
      Scope.close(this.scope, Exit.void),
    ));
  }
}
