import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { expect, it } from 'vitest';
import { createHttpListener } from './server-factory.ts';

it('shares listener close failure through draining and opens a fresh lifetime afterwards', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const failure = new Error('Listener cleanup failed');
  const order: string[] = [];
  let generations = 0;
  const listener = createHttpListener({
    application: Layer.mergeAll(
      HttpRouter.add('GET', '/', HttpServerResponse.text('owned listener')),
      Layer.effectDiscard(
        Effect.gen(function* () {
          const generation = ++generations;
          yield* Effect.addFinalizer(() =>
            generation === 1
              ? Effect.promise(async () => {
                  order.push('drain-start');
                  started.resolve();
                  await release.promise;
                  order.push('drain-end');
                }).pipe(Effect.andThen(Effect.die(failure)))
              : Effect.sync(() => {
                  order.push('second-lifetime-closed');
                }),
          );
        }),
      ),
    ),
    principal: { kind: 'owner' },
    logger: { failure: () => undefined },
    websocketMaxBytes: 1024,
  });
  try {
    const address = await listener.listen({ host: '127.0.0.1', port: 0 });
    expect(await (await fetch(address)).text()).toBe('owned listener');
    const first = listener.close();
    await started.promise;
    let secondFinished = false;
    const second = listener.close().finally(() => {
      secondFinished = true;
    });
    const results = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(secondFinished).toBe(false);
    expect(order).toEqual(['drain-start']);
    await expect(
      listener.listen({ host: '127.0.0.1', port: 0 }),
    ).rejects.toThrow('HTTP listener is already open');
    release.resolve();
    const closed = await results;
    expect(closed.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(
      closed.map(
        (result): unknown => result.status === 'rejected' && result.reason,
      ),
    ).toEqual([failure, failure]);
    await expect(listener.close()).rejects.toBe(failure);
    expect(order).toEqual(['drain-start', 'drain-end']);
    const reopened = await listener.listen({ host: '127.0.0.1', port: 0 });
    expect(await (await fetch(reopened)).text()).toBe('owned listener');
    await Promise.all([listener.close(), listener.close()]);
    await listener.close();
    expect(order).toEqual([
      'drain-start',
      'drain-end',
      'second-lifetime-closed',
    ]);
    expect(generations).toBe(2);
  } finally {
    release.resolve();
    await listener.close().catch(() => undefined);
  }
});
