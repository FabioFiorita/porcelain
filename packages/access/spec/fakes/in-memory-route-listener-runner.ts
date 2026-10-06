import { Effect } from 'effect';
import type {
  ListenOutcome,
  RouteAddresses,
  RouteKey,
} from '../../src/models/remote-access.ts';
import type { RouteListenerRunner } from '../../src/ports/route-listener-runner.ts';

export class InMemoryRouteListenerRunner implements RouteListenerRunner {
  private readonly ports: Record<string, number>;
  private readonly taken: readonly number[];
  private readonly listening = new Map<
    string,
    { addresses: string[]; port: number }
  >();

  constructor(serverPort: number, ownPort: number, taken: readonly number[]) {
    this.ports = { server: serverPort, own: ownPort };
    this.taken = taken;
  }

  listen(input: RouteAddresses): Effect.Effect<ListenOutcome> {
    return Effect.sync(() => {
      const port = this.ports[String(input.port)] ?? Number(input.port);
      const bound = input.addresses.filter(() => !this.taken.includes(port));
      this.listening.set(input.route, { addresses: bound, port });
      return { port, bound };
    });
  }

  close(input: RouteKey): Effect.Effect<void> {
    return Effect.sync(() => {
      this.listening.delete(input.route);
    });
  }

  bound(input: RouteKey): string[] {
    return [...(this.listening.get(input.route)?.addresses ?? [])];
  }
}
