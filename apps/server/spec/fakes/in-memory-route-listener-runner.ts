import { Effect } from 'effect';
import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '@porcelain/access/models';
import type { RouteListenerRunner } from '@porcelain/access/ports';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly ports: Record<string, () => number>;
  private readonly listening = new Map<string, string[]>();

  constructor(serverPort: () => number, ownPort: () => number) {
    this.ports = { server: serverPort, own: ownPort };
  }

  listen(input: RouteAddresses): Effect.Effect<ListenOutcome> {
    return Effect.sync(() => {
      this.listening.set(input.route, [...input.addresses]);
      return {
        port: this.ports[String(input.port)]?.() ?? Number(input.port),
        bound: [...input.addresses],
      };
    });
  }

  close(input: RouteKey): Effect.Effect<void> {
    return Effect.sync(() => {
      this.listening.delete(input.route);
    });
  }
}
