import type { ListenOutcome } from '../../src/models/remote-access.ts';
import type { RouteListenerRunner } from '../../src/ports/route-listener-runner.ts';

export class FixedRouteListenerRunner implements RouteListenerRunner {
  private readonly port: number;
  private readonly failure: 'address-in-use' | 'address-unavailable';

  constructor(port: number, failure: 'address-in-use' | 'address-unavailable') {
    this.port = port;
    this.failure = failure;
  }

  async listen(): Promise<ListenOutcome> {
    return { port: this.port, bound: [], failure: this.failure };
  }

  async close(): Promise<void> {}
}
