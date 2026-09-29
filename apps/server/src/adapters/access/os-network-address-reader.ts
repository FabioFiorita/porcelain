import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';

const ROUTE_TABLE = '/proc/net/route';
const NEIGHBOUR_TABLE = '/proc/net/arp';
const INTERFACES = '/sys/class/net';

function physical(name: string): boolean {
  return !name.includes('/') && existsSync(`${INTERFACES}/${name}/device`);
}

function kernelTable(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

export class OsNetworkAddressReader implements NetworkAddressReader {
  list(): NetworkAddress[] {
    return Object.entries(networkInterfaces()).flatMap(([name, entries]) => {
      const hardware = physical(name);
      return (entries ?? []).map((entry) => ({
        interfaceName: name,
        address: entry.address,
        family: entry.family,
        internal: entry.internal,
        physical: hardware,
        netmask: entry.netmask,
        ...(entry.cidr === null ? {} : { cidr: entry.cidr }),
      }));
    });
  }

  routeTable(): string {
    return kernelTable(ROUTE_TABLE);
  }

  neighbourTable(): string {
    return kernelTable(NEIGHBOUR_TABLE);
  }
}
