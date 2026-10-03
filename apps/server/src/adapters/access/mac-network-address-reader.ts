import { networkInterfaces } from 'node:os';
import type { DefaultRoute, NetworkAddress } from '@porcelain/access/models';
import type { NetworkAddressReader } from '@porcelain/access/ports';
import type { Limits } from '../../config/limits.ts';
import { readMacPrimaryService, readMacRoute } from './mac-network-command.ts';
import {
  macDefaultRoutes,
  macPhysicalInterface,
} from './mac-network-output.ts';

export class MacNetworkAddressReader implements NetworkAddressReader {
  private readonly limits: Limits['access']['networkDiscovery'];

  constructor(limits: Limits['access']['networkDiscovery']) {
    this.limits = limits;
  }

  list(): NetworkAddress[] {
    return Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
      (entries ?? []).map((entry) => ({
        interfaceName: name,
        address: entry.address,
        family: entry.family,
        internal: entry.internal,
        physical: macPhysicalInterface(name),
        netmask: entry.netmask,
        ...(entry.cidr === null ? {} : { cidr: entry.cidr }),
      })),
    );
  }

  async defaultRoutes(): Promise<DefaultRoute[]> {
    const [route, service] = await Promise.all([
      readMacRoute(this.limits),
      readMacPrimaryService(this.limits),
    ]);
    return macDefaultRoutes(route, service);
  }
}
