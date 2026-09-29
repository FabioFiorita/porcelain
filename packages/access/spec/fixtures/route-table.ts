const HEADER =
  'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT';

export const laptopRouteTable = [
  'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT                                                       ',
  'wlp2s0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0                                                                             ',
  'tun0\t0000080A\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0                                                                               ',
  'tun0\t0000590A\t0100080A\t0003\t0\t0\t200\t00FFFFFF\t0\t0\t0                                                                             ',
  'docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0                                                                            ',
  'br-5c1e0d2a9f3b\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0                                                                    ',
  'virbr0\t007AA8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0                                                                             ',
  'wlp2s0\t0001A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0                                                                             ',
  '',
].join('\n');

export const fullTunnelVpnRouteTable = [
  'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT                                                       ',
  'tun0\t00000000\t0100080A\t0003\t0\t0\t50\t00000000\t0\t0\t0                                                                               ',
  'wlp2s0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0                                                                             ',
  'tun0\t0000080A\t00000000\t0001\t0\t0\t50\t00FFFFFF\t0\t0\t0                                                                               ',
  'wlp2s0\t0001A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0                                                                             ',
  '',
].join('\n');

export function routeTableVia(interfaceName: string): string {
  return `${HEADER}\n${interfaceName}\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0\n`;
}
