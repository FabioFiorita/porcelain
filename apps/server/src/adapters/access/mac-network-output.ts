const ROUTE_HEADER = 'Iface Destination Gateway Flags RefCnt Use Metric Mask';
const NEIGHBOUR_HEADER = 'IP address HW type Flags HW address Mask Device';
const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/;
const HARDWARE = /^[\da-f]{1,2}(?::[\da-f]{1,2}){5}$/i;

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

export function macRouteTable(output: string): string {
  const route = macDefaultRoute(output);
  if (route === undefined) return ROUTE_HEADER;
  const hex = route.gateway
    .split('.')
    .reverse()
    .map((octet) => Number(octet).toString(16).padStart(2, '0'))
    .join('');
  return `${ROUTE_HEADER}\n${route.interfaceName} 00000000 ${hex} 0003 0 0 0 00000000`;
}

export function macPrimaryService(output: string): string | undefined {
  const service = /^\s*PrimaryService : (\S+)\s*$/m.exec(output)?.[1];
  return service !== undefined && /^[\dA-F-]+$/i.test(service)
    ? service
    : undefined;
}

export function macNeighbourTable(output: string): string {
  const value = (key: string) =>
    new RegExp(`^\\s*${key} : (\\S+)\\s*$`, 'm').exec(output)?.[1];
  const address = value('ARPResolvedIPAddress');
  const hardware = value('ARPResolvedHardwareAddress');
  const device = value('InterfaceName');
  if (
    address === undefined ||
    hardware === undefined ||
    device === undefined ||
    !IPV4.test(address) ||
    !HARDWARE.test(hardware)
  )
    return NEIGHBOUR_HEADER;
  const normalized = hardware
    .split(':')
    .map((octet) => (octet.length === 1 ? `0${octet}` : octet))
    .join(':')
    .toLowerCase();
  return `${NEIGHBOUR_HEADER}\n${address} 0x1 0x2 ${normalized} * ${device}`;
}
