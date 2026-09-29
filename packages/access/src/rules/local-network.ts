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
const ANY_DESTINATION = '00000000';
const HARDWARE = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/;
const NO_HARDWARE = '00:00:00:00:00:00';
const ROUTE_UP = 1;

function routeAddress(hex: string | undefined): string {
  return (hex?.match(/[0-9A-Fa-f]{2}/g) ?? [])
    .map((pair) => Number(`0x${pair}`))
    .reverse()
    .join('.');
}

export function gatewayHardware(
  table: string,
  gateway: string,
  interfaceName: string,
): string | undefined {
  return table
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(
      ([address, , , , , device]) =>
        address === gateway && device === interfaceName,
    )
    .map(([, , , hardware]) => hardware?.toLowerCase() ?? '')
    .find((hardware) => HARDWARE.test(hardware) && hardware !== NO_HARDWARE);
}

export function defaultRoutes(table: string): DefaultRoute[] {
  return table
    .split('\n')
    .slice(1)
    .flatMap((line) => {
      const [interfaceName, destination, gateway, flags, , , metric, mask] =
        line.trim().split(/\s+/);
      const up = (Number(`0x${flags ?? ''}`) & ROUTE_UP) === ROUTE_UP;
      const order = Number(metric);
      return interfaceName &&
        destination === ANY_DESTINATION &&
        mask === ANY_DESTINATION &&
        up &&
        Number.isInteger(order)
        ? [{ interfaceName, metric: order, gateway: routeAddress(gateway) }]
        : [];
    })
    .sort((left, right) => left.metric - right.metric);
}

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
  neighbours: string,
): LocalNetworkAddress | undefined {
  for (const route of routes)
    for (const entry of addresses) {
      if (entry.interfaceName !== route.interfaceName || !onLocalNetwork(entry))
        continue;
      const subnet =
        entry.cidr === undefined || entry.netmask === undefined
          ? undefined
          : subnetOf(entry.address, entry.netmask, entry.cidr);
      const hardware = gatewayHardware(
        neighbours,
        route.gateway,
        entry.interfaceName,
      );
      if (subnet !== undefined)
        return {
          interfaceName: entry.interfaceName,
          subnet,
          gateway: route.gateway,
          ...(hardware === undefined ? {} : { gatewayHardware: hardware }),
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
