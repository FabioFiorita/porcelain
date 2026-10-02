import { describe, expect, it } from 'vitest';
import {
  linuxNetworkOutput,
  neighbourTableWith,
} from '../../../spec/fixtures/linux-network-output.ts';
import { linuxDefaultRoutes } from './linux-network-output.ts';

const { laptopRoutes, fullTunnelVpnRoutes, laptopNeighbours } =
  linuxNetworkOutput;

describe('Linux network output', () => {
  it('finds the default route of a laptop with Wi-Fi, a VPN, Docker and libvirt, with its router hardware in lower case, and none of their own networks', () => {
    expect(linuxDefaultRoutes(laptopRoutes, laptopNeighbours)).toEqual([
      {
        interfaceName: 'wlp2s0',
        metric: 600,
        gateway: '192.168.1.1',
        gatewayHardware: 'a4:91:b1:0c:7e:11',
      },
    ]);
  });

  it('lists every default route with its metric when a VPN takes the default route', () => {
    expect(linuxDefaultRoutes(fullTunnelVpnRoutes, laptopNeighbours)).toEqual([
      { interfaceName: 'tun0', metric: 50, gateway: '10.8.0.1' },
      {
        interfaceName: 'wlp2s0',
        metric: 600,
        gateway: '192.168.1.1',
        gatewayHardware: 'a4:91:b1:0c:7e:11',
      },
    ]);
  });

  it('finds nothing in an empty or unreadable route table, and reads past an unreadable line in a readable one', () => {
    expect(linuxDefaultRoutes('', laptopNeighbours)).toEqual([]);
    expect(
      linuxDefaultRoutes(
        'Iface\tDestination\ngarbage line\n',
        laptopNeighbours,
      ),
    ).toEqual([]);
    expect(
      linuxDefaultRoutes(`${laptopRoutes}garbage line\n`, laptopNeighbours),
    ).toEqual([
      {
        interfaceName: 'wlp2s0',
        metric: 600,
        gateway: '192.168.1.1',
        gatewayHardware: 'a4:91:b1:0c:7e:11',
      },
    ]);
  });

  it('skips a default route that is down and keeps the ones that are up', () => {
    const down = laptopRoutes.replace(
      'wlp2s0\t00000000\t0101A8C0\t0003',
      'wlp2s0\t00000000\t0101A8C0\t0002',
    );
    expect(linuxDefaultRoutes(down, laptopNeighbours)).toEqual([]);
    const vpnWithWifiDown = fullTunnelVpnRoutes.replace(
      'wlp2s0\t00000000\t0101A8C0\t0003',
      'wlp2s0\t00000000\t0101A8C0\t0002',
    );
    expect(linuxDefaultRoutes(vpnWithWifiDown, laptopNeighbours)).toEqual([
      { interfaceName: 'tun0', metric: 50, gateway: '10.8.0.1' },
    ]);
  });

  it.each([
    [
      'a neighbour table that does not list the router',
      neighbourTableWith('192.168.1.254', 'a4:91:b1:0c:7e:11', 'wlp2s0'),
    ],
    [
      'the router seen on another interface',
      neighbourTableWith('192.168.1.1', 'a4:91:b1:0c:7e:11', 'enp3s0'),
    ],
    [
      'a router entry still being resolved',
      neighbourTableWith('192.168.1.1', '00:00:00:00:00:00', 'wlp2s0'),
    ],
    ['an empty neighbour table', ''],
  ])('leaves the router hardware unknown for %s', (_, neighbours) => {
    expect(linuxDefaultRoutes(laptopRoutes, neighbours)).toEqual([
      { interfaceName: 'wlp2s0', metric: 600, gateway: '192.168.1.1' },
    ]);
  });
});
