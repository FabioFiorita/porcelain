import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import type { DefaultRoute, NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';
import { linuxDefaultRoutes } from './linux-network-output.ts';

const ROUTE_TABLE = '/proc/net/route';
const NEIGHBOUR_TABLE = '/proc/net/arp';
const INTERFACES = '/sys/class/net';

function physical(name: string): boolean {
  return !name.includes('/') && existsSync(`${INTERFACES}/${name}/device`);
}

async function kernelTable(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
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

  async defaultRoutes(): Promise<DefaultRoute[]> {
    const [routes, neighbours] = await Promise.all([
      kernelTable(ROUTE_TABLE),
      kernelTable(NEIGHBOUR_TABLE),
    ]);
    return linuxDefaultRoutes(routes, neighbours);
  }
}
