import type {
  DefaultRoute,
  NetworkAddress,
} from '../../src/models/remote-access.ts';
import type { NetworkAddressReader } from '../../src/ports/network-address-reader.ts';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private addresses: NetworkAddress[];
  private routes: DefaultRoute[];

  constructor(addresses: NetworkAddress[], routes: DefaultRoute[]) {
    this.addresses = addresses;
    this.routes = routes;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  async defaultRoutes(): Promise<DefaultRoute[]> {
    return this.routes.map((route) => ({ ...route }));
  }

  replace(addresses: NetworkAddress[], routes = this.routes): void {
    this.addresses = addresses;
    this.routes = routes;
  }
}
