import { it, expect } from '@effect/vitest';
import { TestClock } from 'effect/testing';
import { Context, Effect, Layer, Stream } from 'effect';
import { NodeHttpClient, NodeHttpServer } from '@effect/platform-node';
import { HttpServer, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { TunnelProbe } from '@porcelain/access/ports';
import { httpTunnelProbeLayer } from './http-tunnel-probe.ts';

const openHttpPeer = Effect.fn('openHttpPeer')(function* () {
  const context = yield* Layer.build(NodeHttpServer.layerTest);
  const server = Context.get(context, HttpServer.HttpServer);
  const peer = {
    origin: HttpServer.formatAddress(server.address),
    reply: {
      status: 200,
      body: '',
      headers: {} as Record<string, string>,
      pending: 'none' as 'none' | 'headers' | 'body',
    },
    requests: [] as {
      method: string;
      path: string;
      accept: string | undefined;
    }[],
  };
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      peer.requests.push({
        method: request.method,
        path: request.url,
        accept: request.headers.accept,
      });
      if (peer.reply.pending === 'headers')
        return yield* Effect.interruptible(Effect.never);
      const options = {
        status: peer.reply.status,
        headers: peer.reply.headers,
      };
      return peer.reply.pending === 'body'
        ? HttpServerResponse.stream(
            Stream.concat(
              Stream.succeed(new TextEncoder().encode(peer.reply.body)),
              Stream.never,
            ),
            options,
          )
        : HttpServerResponse.text(peer.reply.body, options);
    }),
  );
  return peer;
});

it.effect(
  'distinguishes the health contract, foreign responses, server failures and redirects over real HTTP',
  () =>
    Effect.gen(function* () {
      const peer = yield* openHttpPeer();
      peer.reply.body = JSON.stringify({
        status: 'ok',
        environmentId: 'environment-1',
      });
      const context = yield* Layer.build(
        httpTunnelProbeLayer({ timeoutMs: 1000 }).pipe(
          Layer.provide(NodeHttpClient.layerFetch),
        ),
      );
      const probe = Context.get(context, TunnelProbe);
      const target = { origin: peer.origin };
      expect(yield* probe.probe(target)).toEqual({
        kind: 'answered',
        environmentId: 'environment-1',
      });
      peer.reply = {
        status: 200,
        body: 'invalid JSON',
        headers: {},
        pending: 'none',
      };
      expect(yield* probe.probe(target)).toEqual({ kind: 'foreign' });
      peer.reply = {
        status: 200,
        body: JSON.stringify({ status: 'ok' }),
        headers: {},
        pending: 'none',
      };
      expect(yield* probe.probe(target)).toEqual({ kind: 'foreign' });
      peer.reply = { status: 403, body: '', headers: {}, pending: 'none' };
      expect(yield* probe.probe(target)).toEqual({ kind: 'foreign' });
      peer.reply = { status: 503, body: '', headers: {}, pending: 'none' };
      expect(yield* probe.probe(target)).toEqual({ kind: 'unreachable' });
      peer.reply = {
        status: 302,
        body: '',
        headers: { location: '/api/health' },
        pending: 'none',
      };
      expect(yield* probe.probe(target)).toEqual({ kind: 'unreachable' });
      expect(peer.requests).toEqual(
        Array.from({ length: 6 }, () => ({
          method: 'GET',
          path: '/api/health',
          accept: 'application/json',
        })),
      );
    }).pipe(TestClock.withLive),
);

it.effect('times out an HTTP server that never sends response headers', () =>
  Effect.gen(function* () {
    const peer = yield* openHttpPeer();
    peer.reply.pending = 'headers';
    const context = yield* Layer.build(
      httpTunnelProbeLayer({ timeoutMs: 100 }).pipe(
        Layer.provide(NodeHttpClient.layerFetch),
      ),
    );
    expect(
      yield* Context.get(context, TunnelProbe).probe({
        origin: peer.origin,
      }),
    ).toEqual({ kind: 'unreachable' });
    expect(peer.requests).toHaveLength(1);
  }).pipe(TestClock.withLive),
);

it.effect(
  'keeps the probe deadline while a successful response body never finishes',
  () =>
    Effect.gen(function* () {
      const peer = yield* openHttpPeer();
      peer.reply.pending = 'body';
      peer.reply.body = '{';
      const context = yield* Layer.build(
        httpTunnelProbeLayer({ timeoutMs: 100 }).pipe(
          Layer.provide(NodeHttpClient.layerFetch),
        ),
      );
      expect(
        yield* Context.get(context, TunnelProbe).probe({
          origin: peer.origin,
        }),
      ).toEqual({ kind: 'foreign' });
      expect(peer.requests).toHaveLength(1);
    }).pipe(TestClock.withLive),
);
