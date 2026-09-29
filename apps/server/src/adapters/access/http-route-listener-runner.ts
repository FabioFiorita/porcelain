import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import type {
  ListenedRoute,
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '@porcelain/access/models';
import type { RouteListenerRunner } from '@porcelain/access/ports';

type Bound = { server: Server; sockets: Set<Socket> };

type Bind =
  | { kind: 'bound'; bound: Bound }
  | { kind: 'failed'; failure: 'address-in-use' | 'address-unavailable' };

export class HttpRouteListenerRunner implements RouteListenerRunner {
  private readonly target: () => Server;
  private readonly routes = new Map<ListenedRoute, Map<string, Bound>>();

  constructor(target: () => Server) {
    this.target = target;
  }

  async listen(
    input: RouteAddresses,
    signal: AbortSignal,
  ): Promise<ListenOutcome> {
    const port = await this.port(signal);
    const open = this.routes.get(input.route) ?? new Map<string, Bound>();
    this.routes.set(input.route, open);
    for (const [address, bound] of open)
      if (!input.addresses.includes(address)) {
        open.delete(address);
        await this.stop(bound);
      }
    const failures: ('address-in-use' | 'address-unavailable')[] = [];
    for (const address of input.addresses) {
      if (open.has(address)) continue;
      const result = await this.bind(address, port);
      if (result.kind === 'bound') open.set(address, result.bound);
      else failures.push(result.failure);
    }
    const failure = failures.includes('address-in-use')
      ? 'address-in-use'
      : failures[0];
    return {
      port,
      bound: input.addresses.filter((address) => open.has(address)),
      ...(failure === undefined ? {} : { failure }),
    };
  }

  async close(input: RouteKey): Promise<void> {
    const open = this.routes.get(input.route);
    this.routes.delete(input.route);
    await Promise.all(
      [...(open?.values() ?? [])].map((bound) => this.stop(bound)),
    );
  }

  private async port(signal: AbortSignal | undefined): Promise<number> {
    const target = this.target();
    if (!target.listening)
      await once(target, 'listening', signal ? { signal } : {});
    const address = target.address();
    if (address === null || typeof address === 'string')
      throw new Error('The server does not listen on a network port');
    return address.port;
  }

  private bind(address: string, port: number): Promise<Bind> {
    const sockets = new Set<Socket>();
    const server = createServer();
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.once('close', () => sockets.delete(socket));
    });
    const target = this.target();
    server.on('request', (request, response) =>
      target.emit('request', request, response),
    );
    server.on('upgrade', (request, socket, head) =>
      target.emit('upgrade', request, socket, head),
    );
    return new Promise((resolve) => {
      server.once('error', (error: NodeJS.ErrnoException) => {
        server.close();
        resolve({
          kind: 'failed',
          failure:
            error.code === 'EADDRINUSE'
              ? 'address-in-use'
              : 'address-unavailable',
        });
      });
      server.listen({ host: address, port, exclusive: true }, () =>
        resolve({ kind: 'bound', bound: { server, sockets } }),
      );
    });
  }

  private async stop(bound: Bound): Promise<void> {
    const closed = new Promise<void>((resolve) =>
      bound.server.close(() => resolve()),
    );
    for (const socket of bound.sockets) socket.destroy();
    await closed;
  }
}
