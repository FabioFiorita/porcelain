import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '../../src/models/remote-access.ts';
import type { RouteListenerRunner } from '../../src/ports/route-listener-runner.ts';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly ports: Record<RouteAddresses['port'], number>;
  private readonly listening = new Map<string, RouteAddresses>();

  constructor(serverPort: number, ownPort: number) {
    this.ports = { server: serverPort, own: ownPort };
  }

  async listen(input: RouteAddresses): Promise<ListenOutcome> {
    this.listening.set(input.route, input);
    return { port: this.ports[input.port], bound: [...input.addresses] };
  }

  async close(input: RouteKey): Promise<void> {
    this.listening.delete(input.route);
  }

  bound(input: RouteKey): string[] {
    return [...(this.listening.get(input.route)?.addresses ?? [])];
  }
}
