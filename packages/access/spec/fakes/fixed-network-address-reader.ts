import type { NetworkAddress } from '../../src/models/remote-access.ts';
import type { NetworkAddressReader } from '../../src/ports/network-address-reader.ts';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private addresses: NetworkAddress[];
  private table: string;
  private neighbours: string;

  constructor(addresses: NetworkAddress[], table: string, neighbours: string) {
    this.addresses = addresses;
    this.table = table;
    this.neighbours = neighbours;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  routeTable(): string {
    return this.table;
  }

  neighbourTable(): string {
    return this.neighbours;
  }

  replace(
    addresses: NetworkAddress[],
    table = this.table,
    neighbours = this.neighbours,
  ): void {
    this.addresses = addresses;
    this.table = table;
    this.neighbours = neighbours;
  }
}
