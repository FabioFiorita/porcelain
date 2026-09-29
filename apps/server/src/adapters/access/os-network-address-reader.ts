import { networkInterfaces } from 'node:os';
import type { NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

export class OsNetworkAddressReader implements NetworkAddressReader {
  list(): NetworkAddress[] {
    return Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
      (entries ?? []).map((entry) => ({
        interfaceName: name,
        address: entry.address,
        family: entry.family,
        internal: entry.internal,
      })),
    );
  }
}
