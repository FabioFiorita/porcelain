import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '@porcelain/access/models';
import type { RouteListenerRunner } from '@porcelain/access/ports';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly ports: Record<RouteAddresses['port'], () => number>;
  private readonly listening = new Map<string, string[]>();

  constructor(serverPort: () => number, ownPort: () => number) {
    this.ports = { server: serverPort, own: ownPort };
  }

  async listen(input: RouteAddresses): Promise<ListenOutcome> {
    this.listening.set(input.route, [...input.addresses]);
    return { port: this.ports[input.port](), bound: [...input.addresses] };
  }

  async close(input: RouteKey): Promise<void> {
    this.listening.delete(input.route);
  }
}
