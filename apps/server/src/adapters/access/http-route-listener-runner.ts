import { Effect, Exit, Layer, Scope } from 'effect';
import { NodeHttpServer } from '@effect/platform-node';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import type {
  ListenedRoute,
  RouteAddresses,
  RouteKey,
} from '@porcelain/access/models';
import { RouteListenerRunner } from '@porcelain/access/ports';

type Bound = { port: number; scope: Scope.Closeable };

export const httpRouteListenerRunnerLayer = (target: () => Server) =>
  Layer.effect(
    RouteListenerRunner,
    Effect.gen(function* () {
      const scope = yield* Scope.Scope;
      const routes = new Map<ListenedRoute, Map<string, Bound>>();
      const close = Effect.fn('HttpRouteListenerRunner.close')(function* (
        input: RouteKey,
      ) {
        const open = routes.get(input.route);
        routes.delete(input.route);
        yield* Effect.forEach(
          open?.values() ?? [],
          (bound) => Scope.close(bound.scope, Exit.void),
          { discard: true },
        );
      });
      yield* Effect.addFinalizer(() =>
        Effect.forEach(routes.keys(), (route) => close({ route }), {
          discard: true,
        }),
      );
      const wantedPort = Effect.fn('HttpRouteListenerRunner.wantedPort')(
        function* (port: RouteAddresses['port']) {
          if (port !== 'server') return port === 'own' ? 0 : port;
          const server = target();
          if (!server.listening)
            yield* Effect.callback<void>((resume) => {
              const listening = () => resume(Effect.void);
              server.once('listening', listening);
              return Effect.sync(() => server.off('listening', listening));
            });
          const address = server.address();
          if (address === null || typeof address === 'string')
            return yield* Effect.die(
              new Error('The server does not listen on a network port'),
            );
          return address.port;
        },
      );
      const bind = Effect.fn('HttpRouteListenerRunner.bind')(function* (
        address: string,
        port: number,
      ) {
        const binding = yield* Scope.fork(scope);
        const sockets = new Set<Socket>();
        const server = createServer();
        server.on('connection', (socket) => {
          sockets.add(socket);
          socket.once('close', () => sockets.delete(socket));
        });
        const destination = target();
        server.on('request', (request, response) =>
          destination.emit('request', request, response),
        );
        server.on('upgrade', (request, socket, head) =>
          destination.emit('upgrade', request, socket, head),
        );
        const opened = yield* NodeHttpServer.make(() => server, {
          host: address,
          port,
          exclusive: true,
        }).pipe(Scope.provide(binding), Effect.result);
        if (opened._tag === 'Failure') {
          yield* Scope.close(binding, Exit.void);
          const cause = opened.failure.cause;
          return {
            kind: 'failed' as const,
            failure:
              cause instanceof Error &&
              'code' in cause &&
              cause.code === 'EADDRINUSE'
                ? ('address-in-use' as const)
                : ('address-unavailable' as const),
          };
        }
        yield* Scope.addFinalizer(
          binding,
          Effect.sync(() => {
            for (const socket of sockets) socket.destroy();
          }),
        );
        const boundAddress = server.address();
        return {
          kind: 'bound' as const,
          bound: {
            scope: binding,
            port:
              boundAddress !== null && typeof boundAddress !== 'string'
                ? boundAddress.port
                : 0,
          },
        };
      });
      return {
        listen: Effect.fn('HttpRouteListenerRunner.listen')(function* (
          input: RouteAddresses,
        ) {
          const shared = yield* wantedPort(input.port);
          return yield* Effect.uninterruptible(
            Effect.gen(function* () {
              const open = routes.get(input.route) ?? new Map<string, Bound>();
              routes.set(input.route, open);
              for (const [address, bound] of open) {
                if (
                  !input.addresses.includes(address) ||
                  (shared !== 0 && bound.port !== shared)
                ) {
                  open.delete(address);
                  yield* Scope.close(bound.scope, Exit.void);
                }
              }
              const failures: ('address-in-use' | 'address-unavailable')[] = [];
              for (const address of input.addresses) {
                if (open.has(address)) continue;
                const result = yield* bind(address, shared);
                if (result.kind === 'bound') open.set(address, result.bound);
                else failures.push(result.failure);
              }
              const failure = failures.includes('address-in-use')
                ? 'address-in-use'
                : failures[0];
              const bound = input.addresses.filter((address) =>
                open.has(address),
              );
              const first =
                bound[0] === undefined ? undefined : open.get(bound[0]);
              return {
                port: input.port === 'server' || !first ? shared : first.port,
                bound,
                ...(failure === undefined ? {} : { failure }),
              };
            }),
          );
        }),
        close: (input) => Effect.uninterruptible(close(input)),
      };
    }),
  );
