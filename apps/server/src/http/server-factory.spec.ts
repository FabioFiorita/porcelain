import { Duration, Effect, Exit, Layer, Scope } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { expect, it } from 'vitest';
import { createHttpListener } from './server-factory.ts';
import {
  occupyPort,
  liveSocketRoute,
  liveClient,
  stalledUpgrade,
} from '@porcelain/server/kit/http';

const options = {
  principal: { kind: 'owner' } as const,
  logger: { failure: () => undefined },
  websocketMaxBytes: 1024,
  closeGrace: Duration.millis(100),
};

it('shares listener close failure through draining and opens a fresh lifetime afterwards', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const failure = new Error('Listener cleanup failed');
  const order: string[] = [];
  let generations = 0;
  const listener = createHttpListener({
    ...options,
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
  });
  const scope = Effect.runSync(Scope.make());
  try {
    const opened = await Effect.runPromise(
      listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
    );
    expect(await (await fetch(opened.address)).text()).toBe('owned listener');
    const first = Effect.runPromise(opened.close());
    await started.promise;
    let secondFinished = false;
    const second = Effect.runPromise(opened.close()).finally(() => {
      secondFinished = true;
    });
    const results = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(secondFinished).toBe(false);
    expect(order).toEqual(['drain-start']);
    await expect(
      Effect.runPromise(
        listener
          .start({ host: '127.0.0.1', port: 0 })
          .pipe(Scope.provide(scope)),
      ),
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
    await expect(Effect.runPromise(opened.close())).rejects.toBe(failure);
    expect(order).toEqual(['drain-start', 'drain-end']);
    const reopened = await Effect.runPromise(
      listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
    );
    expect(await (await fetch(reopened.address)).text()).toBe('owned listener');
    await Promise.all([
      Effect.runPromise(reopened.close()),
      Effect.runPromise(reopened.close()),
    ]);
    expect(order).toEqual([
      'drain-start',
      'drain-end',
      'second-lifetime-closed',
    ]);
    expect(generations).toBe(2);
    expect(listener.server.listening).toBe(false);
  } finally {
    release.resolve();
    await Effect.runPromiseExit(Scope.close(scope, Exit.void));
  }
});

it('releases its lifetime when native binding fails without closing the occupied port', async () => {
  const occupied = await occupyPort();
  const address = occupied.server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Missing address');
  const listener = createHttpListener({
    ...options,
    application: HttpRouter.add(
      'GET',
      '/',
      HttpServerResponse.text('listener'),
    ),
  });
  try {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(listener.start({ host: '127.0.0.1', port: address.port })),
    );
    expect(exit._tag).toBe('Failure');
    expect(listener.server.listening).toBe(false);
    expect(occupied.server.listening).toBe(true);
    const response = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const opened = yield* listener.start({ host: '127.0.0.1', port: 0 });
          return yield* Effect.promise(async () =>
            (await fetch(opened.address)).text(),
          );
        }),
      ),
    );
    expect(response).toBe('listener');
    expect(listener.server.listening).toBe(false);
  } finally {
    await occupied.close();
  }
});

it('preserves raw WebSocket ping/pong, payload limits and scoped closure', async () => {
  const pong = Promise.withResolvers<void>();
  const listener = createHttpListener({
    ...options,
    application: liveSocketRoute(pong),
  });
  const scope = Effect.runSync(Scope.make());
  const opened = await Effect.runPromise(
    listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
  );
  const client = liveClient(opened.address);
  try {
    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    await pong.promise;
    expect(client.readyState).toBe(1);
    const closed = new Promise<number>((resolve) =>
      client.once('close', resolve),
    );
    client.send('x'.repeat(1025));
    expect(await closed).toBe(1009);
    await Effect.runPromise(opened.close());
    expect(listener.server.listening).toBe(false);
  } finally {
    client.terminate();
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

it('drains an in-flight HTTP response before closing its request scope', async () => {
  const requested = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  const listener = createHttpListener({
    ...options,
    closeGrace: Duration.seconds(1),
    application: HttpRouter.add(
      'GET',
      '/',
      Effect.promise(async () => {
        requested.resolve();
        await answer.promise;
        return HttpServerResponse.text('drained response');
      }),
    ),
  });
  const scope = Effect.runSync(Scope.make());
  try {
    const opened = await Effect.runPromise(
      listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
    );
    const response = fetch(opened.address);
    await requested.promise;
    const closing = Effect.runPromise(opened.close());
    answer.resolve();
    expect(await (await response).text()).toBe('drained response');
    await closing;
    expect(listener.server.listening).toBe(false);
  } finally {
    answer.resolve();
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

it('completes an active upgraded socket close handshake before interrupting its request scope', async () => {
  const pong = Promise.withResolvers<void>();
  const listener = createHttpListener({
    ...options,
    application: liveSocketRoute(pong),
  });
  const scope = Effect.runSync(Scope.make());
  const opened = await Effect.runPromise(
    listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
  );
  const client = liveClient(opened.address);
  try {
    await pong.promise;
    const closed = new Promise<number>((resolve) =>
      client.once('close', resolve),
    );
    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(await closed).toBe(1001);
    expect(listener.server.listening).toBe(false);
  } finally {
    client.terminate();
    await Effect.runPromiseExit(Scope.close(scope, Exit.void));
  }
});

it('forces an upgraded peer that never answers its close frame to disconnect at the drain deadline', async () => {
  const listener = createHttpListener({
    ...options,
    application: liveSocketRoute({ resolve() {} }),
  });
  const scope = Effect.runSync(Scope.make());
  const opened = await Effect.runPromise(
    listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
  );
  const client = await stalledUpgrade(opened.address);
  try {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    await client.closed;
    expect(client.socket.destroyed).toBe(true);
    expect(listener.server.listening).toBe(false);
  } finally {
    client.socket.destroy();
    await Effect.runPromiseExit(Scope.close(scope, Exit.void));
  }
});
