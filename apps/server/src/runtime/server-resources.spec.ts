import { describe, expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import { ServerComponents, ServerResources } from './server-resources.ts';

describe('managed server resources', () => {
  it('disposes acquired resources exactly once when the opened server closes', async () => {
    const order: string[] = [];
    const listener = {
      listen: () => Promise.resolve('http://127.0.0.1:1'),
      close: () => Promise.resolve(),
      server: { closeAllConnections() {} },
    };
    const resources = new ServerResources(
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
            close: () => Promise.resolve(),
          };
        }),
      ),
    );
    const opened = await resources.open(new AbortController().signal);
    expect(order).toEqual(['opened']);
    await opened.close();
    await opened.close();
    expect(order).toEqual(['opened', 'workers', 'database']);
  });

  it('rolls back every acquired resource and preserves the original startup failure', async () => {
    const failure = new Error('Cannot bind the listener');
    const order: string[] = [];
    const resources = new ServerResources(
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
            }).pipe(Effect.andThen(Effect.die(new Error('Cleanup failed')))),
          );
          return yield* Effect.die(failure);
        }),
      ),
    );
    await expect(resources.open(new AbortController().signal)).rejects.toBe(
      failure,
    );
    expect(order).toEqual(['workers', 'database']);
  });
});
