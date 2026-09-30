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

export function macNeighbourTable(output: string): string {
  const entries = output.split('\n').flatMap((line) => {
    const [, address, hardware, device] =
      /\(([^)]+)\) at (\S+) on (\S+)/.exec(line) ?? [];
    if (
      address === undefined ||
      hardware === undefined ||
      device === undefined ||
      !IPV4.test(address) ||
      !HARDWARE.test(hardware)
    )
      return [];
    const normalized = hardware
      .split(':')
      .map((octet) => (octet.length === 1 ? `0${octet}` : octet))
      .join(':')
      .toLowerCase();
    return [`${address} 0x1 0x2 ${normalized} * ${device}`];
  });
  return [NEIGHBOUR_HEADER, ...entries].join('\n');
}
