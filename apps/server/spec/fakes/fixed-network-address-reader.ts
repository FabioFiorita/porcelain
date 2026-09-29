import type { NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private readonly addresses: NetworkAddress[];
  private readonly table: string;
  private readonly neighbours: string;

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
}
