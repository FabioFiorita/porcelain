import type {
  DefaultRoute,
  LocalNetwork,
  LocalNetworkAddress,
  NetworkAddress,
} from '../models/remote-access.ts';
import { isTailnetAddress } from './remote-access.ts';

const PRIVATE_IPV4 = [/^10\./, /^192\.168\./, /^172\.(?:1[6-9]|2\d|3[01])\./];
const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/;
const PREFIX = /^\/(?:[1-9]|[12]\d|3[0-2])$/;
export function subnetOf(
  address: string,
  netmask: string,
  cidr: string,
): string | undefined {
  const prefix = cidr.slice(cidr.indexOf('/'));
  if (
    !IPV4.test(address) ||
    !IPV4.test(netmask) ||
    !cidr.includes('/') ||
    !PREFIX.test(prefix)
  )
    return undefined;
  const mask = netmask.split('.').map(Number);
  const network = address
    .split('.')
    .map((octet, index) => Number(octet) & (mask[index] ?? 0))
    .join('.');
  return `${network}${prefix}`;
}

function onLocalNetwork(entry: NetworkAddress): boolean {
  return (
    entry.family === 'IPv4' &&
    !entry.internal &&
    entry.physical &&
    !isTailnetAddress(entry.address) &&
    PRIVATE_IPV4.some((range) => range.test(entry.address))
  );
}

export function localNetwork(
  addresses: readonly NetworkAddress[],
  routes: readonly DefaultRoute[],
): LocalNetworkAddress | undefined {
  const preferred = [...routes].sort(
    (left, right) => left.metric - right.metric,
  );
  for (const route of preferred)
    for (const entry of addresses) {
      if (entry.interfaceName !== route.interfaceName || !onLocalNetwork(entry))
        continue;
      const subnet =
        entry.cidr === undefined || entry.netmask === undefined
          ? undefined
          : subnetOf(entry.address, entry.netmask, entry.cidr);
      if (subnet !== undefined)
        return {
          interfaceName: entry.interfaceName,
          subnet,
          gateway: route.gateway,
          ...(route.gatewayHardware === undefined
            ? {}
            : { gatewayHardware: route.gatewayHardware }),
          address: entry.address,
        };
    }
  return undefined;
}

export function sameNetwork(
  left: LocalNetwork | undefined,
  right: LocalNetwork | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    left.gatewayHardware !== undefined &&
    left.interfaceName === right.interfaceName &&
    left.subnet === right.subnet &&
    left.gateway === right.gateway &&
    left.gatewayHardware === right.gatewayHardware
  );
}
