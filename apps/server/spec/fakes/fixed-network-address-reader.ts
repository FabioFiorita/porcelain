import type { DefaultRoute, NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private readonly addresses: NetworkAddress[];
  private readonly routes: DefaultRoute[];

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
}
