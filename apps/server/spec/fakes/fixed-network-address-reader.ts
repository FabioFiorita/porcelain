import type { NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private readonly addresses: NetworkAddress[];

  constructor(addresses: NetworkAddress[]) {
    this.addresses = addresses;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }
}
