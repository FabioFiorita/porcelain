import { createServer, type RequestListener } from 'node:http';
import { connect } from 'node:net';
import {
  NodeHttpServerRequest,
  NodeHttpServer,
  NodeSocket,
} from '@effect/platform-node';
import { NodeLiveSockets } from '../../src/http/node-live-socket.ts';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { request } from 'node:http';
import { LIMITS } from '../../src/config/limits.ts';
import {
  Context,
  Deferred,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  Scope,
} from 'effect';
import type { Principal } from '@porcelain/contracts/access';
import type { HttpApplication } from '../../src/http/application.ts';
import {
  createHttpListener,
  requestBoundary,
} from '../../src/http/server-factory.ts';
import { requestPolicy } from '../../src/http/hooks/request-policy.ts';
import { Observability } from '../../src/runtime/observability.ts';

export async function openHttpApplication(
  application: HttpApplication,
  principal: Principal | undefined,
) {
  const scope = await Effect.runPromise(Scope.make());
  try {
    const context = await Effect.runPromise(
      Layer.build(Observability.layer).pipe(
        Effect.provideService(Scope.Scope, scope),
      ),
    );
    const observability = Context.get(context, Observability);
    const logger = { failure: () => undefined };
    const listener = createHttpListener({
      application: application.pipe(
        Layer.provide(
          requestPolicy(Effect.void).combine(
            requestBoundary({
              principal,
              logger,
              observability,
              bodyBytes: LIMITS.http.bodyBytes,
            }),
          ).layer,
        ),
      ),
      logger,
      principal,
      websocketMaxBytes: LIMITS.liveUpdates.messageBytes,
      closeGrace: LIMITS.listeners.closeGrace,
    });
    const { address } = await Effect.runPromise(
      listener.start({ host: '127.0.0.1', port: 0 }).pipe(Scope.provide(scope)),
    );
    return {
      address,
      close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
      sendChunks: (path: string, chunks: readonly string[]) =>
        new Promise<{ status: number; body: unknown }>((resolve, reject) => {
          const sending = request(
            new URL(path, address),
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'transfer-encoding': 'chunked',
              },
            },
            (response) => {
              response.setEncoding('utf8');
              let text = '';
              response.on('data', (chunk: string) => {
                text += chunk;
              });
              response.once('error', reject);
              response.once('end', () =>
                resolve({
                  status: response.statusCode ?? 0,
                  body: JSON.parse(text),
                }),
              );
            },
          );
          sending.once('error', reject);
          for (const chunk of chunks) sending.write(chunk);
          sending.end();
        }),
      send: (input: {
        method: string;
        path: string;
        headers?: Record<string, string>;
        body?: unknown;
      }) =>
        fetch(new URL(input.path, address), {
          method: input.method,
          headers: { 'content-type': 'application/json', ...input.headers },
          ...(input.body === undefined
            ? {}
            : {
                body:
                  typeof input.body === 'string'
                    ? input.body
                    : JSON.stringify(input.body),
              }),
        }),
    };
  } catch (error) {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    throw error;
  }
}

export async function openNodeHttpServer(
  listener?: RequestListener,
  host = '127.0.0.1',
) {
  const server = createServer(listener);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host, port: 0, ipv6Only: true }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export function occupyPort() {
  return openNodeHttpServer();
}

export function liveSocketRoute(pong: { resolve(): void }) {
  return HttpRouter.add(
    'GET',
    '/',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const socket = yield* request.upgrade;
      yield* socket.reader;
      const sockets = yield* NodeLiveSockets;
      const ws = sockets.get(NodeHttpServerRequest.toIncomingMessage(request));
      if (ws === undefined)
        return yield* Effect.die(new Error('Missing raw socket'));
      ws.once('pong', () => pong.resolve());
      ws.ping();
      return yield* Effect.never;
    }).pipe(Effect.orDie),
  );
}

export function liveClient(address: string) {
  return new NodeSocket.NodeWS.WebSocket(address.replace('http:', 'ws:'));
}

export async function stalledUpgrade(address: string) {
  const url = new URL(address);
  const socket = connect(Number(url.port), url.hostname);
  const upgraded = Promise.withResolvers<void>();
  let headers = '';
  socket.on('data', (chunk: Buffer) => {
    headers += chunk.toString();
    if (headers.startsWith('HTTP/1.1 101') && headers.includes('\r\n\r\n'))
      upgraded.resolve();
  });
  socket.once('error', upgraded.reject);
  socket.once('connect', () =>
    socket.write(
      [
        'GET / HTTP/1.1',
        `Host: ${url.host}`,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        '',
        '',
      ].join('\r\n'),
    ),
  );
  const closed = new Promise<void>((resolve) =>
    socket.once('close', () => resolve()),
  );
  await upgraded.promise;
  return { socket, closed };
}

export const openOwnerProbePeer = Effect.fn('ownerPeer')(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: 'pc-owner-' });
  const socketPath = path.join(directory, 'peer.sock');
  const server = yield* NodeHttpServer.make(createServer, { path: socketPath });
  const received = yield* Deferred.make<void>();
  const disconnected = yield* Deferred.make<void>();
  const state = { status: 200, body: '', pending: false };
  yield* server.serve(
    Effect.gen(function* () {
      yield* Deferred.succeed(received, undefined);
      if (state.pending)
        return yield* Effect.interruptible(Effect.never).pipe(
          Effect.ensuring(Deferred.succeed(disconnected, undefined)),
        );
      return HttpServerResponse.text(state.body, { status: state.status });
    }),
  );
  return { socketPath, state, received, disconnected };
});
