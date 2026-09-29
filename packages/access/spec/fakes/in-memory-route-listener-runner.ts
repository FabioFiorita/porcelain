import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '../../src/models/remote-access.ts';
import type { RouteListenerRunner } from '../../src/ports/route-listener-runner.ts';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly port: number;
  private readonly listening = new Map<string, string[]>();

  constructor(port: number) {
    this.port = port;
  }

  async listen(input: RouteAddresses): Promise<ListenOutcome> {
    this.listening.set(input.route, [...input.addresses]);
    return { port: this.port, bound: [...input.addresses] };
  }

  async close(input: RouteKey): Promise<void> {
    this.listening.delete(input.route);
  }

  bound(input: RouteKey): string[] {
    return this.listening.get(input.route) ?? [];
  }
}
