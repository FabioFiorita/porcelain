import type { NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private readonly addresses: NetworkAddress[];
  private readonly table: string;

  constructor(addresses: NetworkAddress[], table: string) {
    this.addresses = addresses;
    this.table = table;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  routeTable(): string {
    return this.table;
  }
}
