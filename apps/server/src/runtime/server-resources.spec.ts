import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Fiber, Layer, Scope } from 'effect';
import { ServerComponents, openServerResources } from './server-resources.ts';

describe('managed server resources', () => {
  it.each([false, true])(
    'shares concurrent close completion and its result (cleanup fails: %s)',
    async (fails) => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const failure = new Error('Cleanup failed');
      let releases = 0;
      const listener = {
        start: () =>
          Effect.succeed({
            address: 'http://127.0.0.1:1',
            close: () => Effect.void,
          }),
      };
      const scope = Effect.runSync(Scope.make());
      const opened = await Effect.runPromise(
        openServerResources(
          Layer.effect(
            ServerComponents,
            Effect.gen(function* () {
              yield* Effect.addFinalizer(() =>
                Effect.promise(async () => {
                  releases += 1;
                  started.resolve();
                  await release.promise;
                }).pipe(
                  Effect.andThen(fails ? Effect.die(failure) : Effect.void),
                ),
              );
              return {
                jobs: [],
                network: listener,
                owner: listener,
                close: () => Effect.void,
              };
            }),
          ),
        ).pipe(Scope.provide(scope)),
      );
      try {
        const first = Effect.runFork(opened.close());
        await started.promise;
        const second = Effect.runFork(opened.close());
        expect(first.pollUnsafe()).toBeUndefined();
        expect(second.pollUnsafe()).toBeUndefined();
        release.resolve();
        const exits = await Promise.all([
          Effect.runPromise(Fiber.await(first)),
          Effect.runPromise(Fiber.await(second)),
        ]);
        exits.push(await Effect.runPromiseExit(opened.close()));
        expect(exits.map((exit) => exit._tag)).toEqual(
          fails
            ? ['Failure', 'Failure', 'Failure']
            : ['Success', 'Success', 'Success'],
        );
        if (fails)
          expect(
            exits.map(
              (exit) => Exit.isFailure(exit) && Cause.squash(exit.cause),
            ),
          ).toEqual([failure, failure, failure]);
        expect(releases).toBe(1);
      } finally {
        release.resolve();
        await Effect.runPromise(Scope.close(scope, Exit.void));
      }
    },
  );

  it('disposes acquired resources exactly once when the opened server closes', async () => {
    const order: string[] = [];
    const listener = {
      start: () =>
        Effect.succeed({
          address: 'http://127.0.0.1:1',
          close: () => Effect.void,
        }),
    };
    const resources = openServerResources(
      Layer.effect(
        ServerComponents,
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              order.push('database');
            }),
          );
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              order.push('workers');
            }),
          );
          order.push('opened');
          return {
            jobs: [],
            network: listener,
            owner: listener,
            close: () => Effect.void,
          };
        }),
      ),
    );
    const scope = Effect.runSync(Scope.make());
    const opened = await Effect.runPromise(
      resources.pipe(Scope.provide(scope)),
    );
    expect(order).toEqual(['opened']);
    await Effect.runPromise(opened.close());
    await Effect.runPromise(opened.close());
    expect(order).toEqual(['opened', 'workers', 'database']);
    await Effect.runPromise(Scope.close(scope, Exit.void));
  });

  it('rolls back every acquired resource and preserves startup and cleanup failures', async () => {
    const failure = new Error('Cannot bind the listener');
    const cleanup = new Error('Cleanup failed');
    const order: string[] = [];
    const resources = openServerResources(
      Layer.effect(
        ServerComponents,
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              order.push('database');
            }),
          );
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              order.push('workers');
            }).pipe(Effect.andThen(Effect.die(cleanup))),
          );
          return yield* Effect.die(failure);
        }),
      ),
    );
    const exit = await Effect.runPromiseExit(Effect.scoped(resources));
    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit))
      throw new Error('Resource acquisition should fail');
    const defects = exit.cause.reasons
      .filter(Cause.isDieReason)
      .map((reason) => reason.defect);
    expect(defects).toContain(failure);
    expect(defects).toContain(cleanup);
    expect(order).toEqual(['workers', 'database']);
  });
});
