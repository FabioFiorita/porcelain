import { Effect, Layer } from 'effect';
import type { DefaultRoute, NetworkAddress } from '@porcelain/access/models';
import { NetworkAddressReader } from '@porcelain/access/ports';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  readonly layer = Layer.succeed(NetworkAddressReader, this);

  private readonly addresses: NetworkAddress[];
  private readonly routes: DefaultRoute[];

  constructor(addresses: NetworkAddress[], routes: DefaultRoute[]) {
    this.addresses = addresses;
    this.routes = routes;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  defaultRoutes(): Effect.Effect<DefaultRoute[]> {
    return Effect.sync(() => this.routes.map((route) => ({ ...route })));
  }
}
