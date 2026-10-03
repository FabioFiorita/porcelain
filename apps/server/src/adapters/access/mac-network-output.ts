import type { DefaultRoute } from '@porcelain/access/models';

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/;
const HARDWARE = /^[\da-f]{1,2}(?::[\da-f]{1,2}){5}$/i;
const NO_HARDWARE = '00:00:00:00:00:00';

export function macPhysicalInterface(name: string): boolean {
  return /^en\d+$/.test(name);
}

export function macDefaultRoute(
  output: string,
): { gateway: string; interfaceName: string } | undefined {
  const gateway = /^\s*gateway:\s*(\S+)\s*$/m.exec(output)?.[1];
  const interfaceName = /^\s*interface:\s*(\S+)\s*$/m.exec(output)?.[1];
  const destination = /^\s*destination:\s*(\S+)\s*$/m.exec(output)?.[1];
  if (
    gateway === undefined ||
    interfaceName === undefined ||
    !IPV4.test(gateway) ||
    destination !== 'default' ||
    !/^\s*flags:\s*<UP[,>]/m.test(output)
  )
    return undefined;
  return { gateway, interfaceName };
}

export function macPrimaryService(output: string): string | undefined {
  const service = /^\s*PrimaryService : (\S+)\s*$/m.exec(output)?.[1];
  return service !== undefined && /^[\dA-F-]+$/i.test(service)
    ? service
    : undefined;
}

function macRouterHardware(
  output: string,
  route: { gateway: string; interfaceName: string },
): string | undefined {
  const value = (key: string) =>
    new RegExp(`^\\s*${key} : (\\S+)\\s*$`, 'm').exec(output)?.[1];
  const hardware = value('ARPResolvedHardwareAddress');
  if (
    value('ARPResolvedIPAddress') !== route.gateway ||
    value('InterfaceName') !== route.interfaceName ||
    hardware === undefined ||
    !HARDWARE.test(hardware)
  )
    return undefined;
  const normalized = hardware
    .split(':')
    .map((octet) => (octet.length === 1 ? `0${octet}` : octet))
    .join(':')
    .toLowerCase();
  return normalized === NO_HARDWARE ? undefined : normalized;
}

export function macDefaultRoutes(
  routeOutput: string,
  serviceOutput: string,
): DefaultRoute[] {
  const route = macDefaultRoute(routeOutput);
  if (route === undefined) return [];
  const hardware = macRouterHardware(serviceOutput, route);
  return [
    {
      ...route,
      metric: 0,
      ...(hardware === undefined ? {} : { gatewayHardware: hardware }),
    },
  ];
}
