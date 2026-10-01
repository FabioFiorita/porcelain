const NEIGHBOUR_HEADER =
  'IP address       HW type     Flags       HW address            Mask     Device';

export const linuxNetworkOutput = {
  laptopRoutes: [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT                                                       ',
    'wlp2s0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0                                                                             ',
    'tun0\t0000080A\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0                                                                               ',
    'tun0\t0000590A\t0100080A\t0003\t0\t0\t200\t00FFFFFF\t0\t0\t0                                                                             ',
    'docker0\t000011AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0                                                                            ',
    'br-5c1e0d2a9f3b\t000012AC\t00000000\t0001\t0\t0\t0\t0000FFFF\t0\t0\t0                                                                    ',
    'virbr0\t007AA8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\t0\t0\t0                                                                             ',
    'wlp2s0\t0001A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0                                                                             ',
    '',
  ].join('\n'),
  fullTunnelVpnRoutes: [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT                                                       ',
    'tun0\t00000000\t0100080A\t0003\t0\t0\t50\t00000000\t0\t0\t0                                                                               ',
    'wlp2s0\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0                                                                             ',
    'tun0\t0000080A\t00000000\t0001\t0\t0\t50\t00FFFFFF\t0\t0\t0                                                                               ',
    'wlp2s0\t0001A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0                                                                             ',
    '',
  ].join('\n'),
  laptopNeighbours: [
    NEIGHBOUR_HEADER,
    '192.168.1.44     0x1         0x2         3c:22:fb:10:20:30     *        wlp2s0',
    '172.18.0.2       0x1         0x2         02:42:ac:12:00:02     *        br-5c1e0d2a9f3b',
    '192.168.1.1      0x1         0x2         A4:91:B1:0C:7E:11     *        wlp2s0',
    '192.168.1.60     0x1         0x0         00:00:00:00:00:00     *        wlp2s0',
    '',
  ].join('\n'),
};

export function neighbourTableWith(
  gateway: string,
  hardware: string,
  interfaceName: string,
): string {
  return `${NEIGHBOUR_HEADER}\n${gateway}     0x1         0x2         ${hardware}     *        ${interfaceName}\n`;
}
