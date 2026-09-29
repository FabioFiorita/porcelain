import type { NetworkAddress } from '../../src/models/remote-access.ts';
import type { NetworkAddressReader } from '../../src/ports/network-address-reader.ts';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private addresses: NetworkAddress[];
  private table: string;

  constructor(addresses: NetworkAddress[], table = '') {
    this.addresses = addresses;
    this.table = table;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  routeTable(): string {
    return this.table;
  }

  replace(addresses: NetworkAddress[], table = this.table): void {
    this.addresses = addresses;
    this.table = table;
  }
}
