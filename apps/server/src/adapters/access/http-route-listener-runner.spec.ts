import { it, expect } from '@effect/vitest';
import { TestClock } from 'effect/testing';
import { Context, Effect, Exit, Layer, Scope } from 'effect';
import { openNodeHttpServer, stalledUpgrade } from '@porcelain/server/kit/http';
import { NodeHttpClient } from '@effect/platform-node';
import { RouteListenerRunner } from '@porcelain/access/ports';
import { httpRouteListenerRunnerLayer } from './http-route-listener-runner.ts';

const openTarget = Effect.fn('openTarget')(function* (
  body: string = '',
  host: string = '127.0.0.1',
) {
  const peer = yield* Effect.acquireRelease(
    Effect.promise(() =>
      openNodeHttpServer((_request, response) => response.end(body), host),
    ),
    (peer) => Effect.promise(() => peer.close()),
  );
  return peer.server;
});

it.effect(
  'forwards HTTP requests, retains a binding and closes it when a route is disabled',
  () =>
    Effect.gen(function* () {
      const target = yield* openTarget('forwarded');
      const context = yield* Layer.build(
        httpRouteListenerRunnerLayer(() => target),
      );
      const runner = Context.get(context, RouteListenerRunner);
      const input = {
        route: 'lan' as const,
        addresses: ['127.0.0.1'],
        port: 'own' as const,
      };
      const opened = yield* runner.listen(input);
      expect(opened.bound).toEqual(['127.0.0.1']);
      expect(opened.port).toBeGreaterThan(0);
      const url = `http://127.0.0.1:${opened.port}`;
      const client = yield* NodeHttpClient.makeUndici.pipe(
        Effect.provideService(
          NodeHttpClient.Dispatcher,
          yield* NodeHttpClient.makeDispatcher,
        ),
      );
      const body = yield* client
        .get(url)
        .pipe(Effect.flatMap((response) => response.text));
      expect(body).toBe('forwarded');
      expect(yield* runner.listen(input)).toEqual(opened);
      yield* runner.close({ route: 'lan' });
      const closed = yield* client.get(url).pipe(Effect.result);
      expect(closed._tag).toBe('Failure');
      yield* runner.close({ route: 'lan' });
    }).pipe(TestClock.withLive),
);

it.effect(
  'reports an occupied address and releases bindings removed from the desired addresses',
  () =>
    Effect.gen(function* () {
      const target = yield* openTarget();
      const context = yield* Layer.build(
        httpRouteListenerRunnerLayer(() => target),
      );
      const runner = Context.get(context, RouteListenerRunner);
      const opened = yield* runner.listen({
        route: 'lan',
        addresses: ['127.0.0.1'],
        port: 'own',
      });
      const occupied = yield* runner.listen({
        route: 'tailnet',
        addresses: ['127.0.0.1'],
        port: opened.port,
      });
      expect(occupied).toEqual({
        port: opened.port,
        bound: [],
        failure: 'address-in-use',
      });
      expect(
        yield* runner.listen({ route: 'lan', addresses: [], port: 'own' }),
      ).toEqual({ port: 0, bound: [] });
      const rebound = yield* runner.listen({
        route: 'tailnet',
        addresses: ['127.0.0.1'],
        port: opened.port,
      });
      expect(rebound).toEqual({ port: opened.port, bound: ['127.0.0.1'] });
    }).pipe(TestClock.withLive),
);

it.effect(
  'uses the main server port and reports an unavailable local address',
  () =>
    Effect.gen(function* () {
      const target = yield* openTarget('same port', '::1');
      const context = yield* Layer.build(
        httpRouteListenerRunnerLayer(() => target),
      );
      const runner = Context.get(context, RouteListenerRunner);
      const opened = yield* runner.listen({
        route: 'lan',
        addresses: ['127.0.0.1'],
        port: 'server',
      });
      const address = target.address();
      expect(opened.port).toBe(
        address !== null && typeof address !== 'string' ? address.port : 0,
      );
      expect(opened.bound).toEqual(['127.0.0.1']);
      const unavailable = yield* runner.listen({
        route: 'tailnet',
        addresses: ['192.0.2.251'],
        port: 'own',
      });
      expect(unavailable).toEqual({
        port: 0,
        bound: [],
        failure: 'address-unavailable',
      });
    }).pipe(TestClock.withLive),
);

it.effect(
  'forwards upgrades and closes upgraded sockets when a route is disabled',
  () =>
    Effect.gen(function* () {
      const target = yield* openTarget();
      const upgraded = Promise.withResolvers<string>();
      target.on('upgrade', (request, socket) => {
        upgraded.resolve(request.url ?? '');
        socket.write(
          'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
        );
      });
      const context = yield* Layer.build(
        httpRouteListenerRunnerLayer(() => target),
      );
      const runner = Context.get(context, RouteListenerRunner);
      const opened = yield* runner.listen({
        route: 'lan',
        addresses: ['127.0.0.1'],
        port: 'own',
      });
      const peer = yield* Effect.promise(() =>
        stalledUpgrade(`http://127.0.0.1:${opened.port}`),
      );
      expect(yield* Effect.promise(() => upgraded.promise)).toBe('/');
      yield* runner.close({ route: 'lan' });
      yield* Effect.promise(() => peer.closed);
      expect(peer.socket.destroyed).toBe(true);
    }).pipe(TestClock.withLive),
);

it.effect('closing the owning layer releases the real listening port', () =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const target = yield* openTarget();
    const context = yield* Layer.build(
      httpRouteListenerRunnerLayer(() => target),
    ).pipe(Scope.provide(scope));
    const runner = Context.get(context, RouteListenerRunner);
    const opened = yield* runner.listen({
      route: 'tailnet',
      addresses: ['127.0.0.1'],
      port: 'own',
    });
    yield* Scope.close(scope, Exit.void);
    const client = yield* NodeHttpClient.makeUndici.pipe(
      Effect.provideService(
        NodeHttpClient.Dispatcher,
        yield* NodeHttpClient.makeDispatcher,
      ),
    );
    const result = yield* client
      .get(`http://127.0.0.1:${opened.port}`)
      .pipe(Effect.result);
    expect(result._tag).toBe('Failure');
  }).pipe(TestClock.withLive),
);
