import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '@porcelain/access/models';
import type { RouteListenerRunner } from '@porcelain/access/ports';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly port: () => number;
  private readonly listening = new Map<string, string[]>();

  constructor(port: () => number) {
    this.port = port;
  }

  async listen(input: RouteAddresses): Promise<ListenOutcome> {
    this.listening.set(input.route, [...input.addresses]);
    return { port: this.port(), bound: [...input.addresses] };
  }

  async close(input: RouteKey): Promise<void> {
    this.listening.delete(input.route);
  }
}
