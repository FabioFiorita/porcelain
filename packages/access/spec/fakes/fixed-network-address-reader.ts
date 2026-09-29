import type { NetworkAddress } from '../../src/models/remote-access.ts';
import type { NetworkAddressReader } from '../../src/ports/network-address-reader.ts';

export class FixedNetworkAddressReader implements NetworkAddressReader {
  private addresses: NetworkAddress[];

  constructor(addresses: NetworkAddress[]) {
    this.addresses = addresses;
  }

  list(): NetworkAddress[] {
    return [...this.addresses];
  }

  replace(addresses: NetworkAddress[]): void {
    this.addresses = addresses;
  }
}
