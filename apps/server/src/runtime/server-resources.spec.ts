import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Layer, Scope } from 'effect';
import { ServerComponents, openServerResources } from './server-resources.ts';

describe('managed server resources', () => {
  it('disposes acquired resources exactly once when the opened server closes', async () => {
    const order: string[] = [];
    const listener = {
      listen: () => Promise.resolve('http://127.0.0.1:1'),
      close: () => Promise.resolve(),
      server: { closeAllConnections() {} },
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
