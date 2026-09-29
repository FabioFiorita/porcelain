import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import {
  fullTunnelVpnRouteTable,
  laptopNeighbourTable,
  laptopRouteTable,
} from '../../spec/fixtures/route-table.ts';
import {
  defaultRoutes,
  gatewayHardware,
  localNetwork,
  sameNetwork,
  subnetOf,
} from './local-network.ts';

const netmasks: Record<string, string> = {
  '8': '255.0.0.0',
  '16': '255.255.0.0',
  '24': '255.255.255.0',
  '32': '255.255.255.255',
};

function address(
  interfaceName: string,
  cidr: string,
  extra: Partial<NetworkAddress> = {},
): NetworkAddress {
  const [value = '', prefix = ''] = cidr.split('/');
  return {
    interfaceName,
    address: value,
    family: value.includes(':') ? 'IPv6' : 'IPv4',
    internal: false,
    physical: false,
    netmask: netmasks[prefix] ?? 'ffff:ffff:ffff:ffff::',
    cidr,
    ...extra,
  };
}

const laptop = [
  address('lo', '127.0.0.1/8', { internal: true }),
  address('wlp2s0', '192.168.1.20/24', { physical: true }),
  address('wlp2s0', 'fe80::1c2d:3eff:fe4f:5a6b/64', { physical: true }),
  address('tun0', '10.8.0.51/24'),
  address('docker0', '172.17.0.1/16'),
  address('br-5c1e0d2a9f3b', '172.18.0.1/16'),
  address('virbr0', '192.168.122.1/24'),
  address('tailscale0', '100.101.102.103/32'),
];

describe('defaultRoutes', () => {
  it('finds the default route of a laptop with Wi-Fi, a VPN, Docker and libvirt, and none of their own networks', () => {
    expect(defaultRoutes(laptopRouteTable)).toEqual([
      { interfaceName: 'wlp2s0', metric: 600, gateway: '192.168.1.1' },
    ]);
  });

  it('lists every default route, the preferred one first, when a VPN takes the default route', () => {
    expect(defaultRoutes(fullTunnelVpnRouteTable)).toEqual([
      { interfaceName: 'tun0', metric: 50, gateway: '10.8.0.1' },
      { interfaceName: 'wlp2s0', metric: 600, gateway: '192.168.1.1' },
    ]);
  });

  it('finds nothing in an empty or unreadable table', () => {
    expect(defaultRoutes('')).toEqual([]);
    expect(defaultRoutes('Iface\tDestination\ngarbage line\n')).toEqual([]);
  });

  it('skips a default route that is down', () => {
    const down = laptopRouteTable.replace(
      'wlp2s0\t00000000\t0101A8C0\t0003',
      'wlp2s0\t00000000\t0101A8C0\t0002',
    );
    expect(defaultRoutes(down)).toEqual([]);
  });
});

describe('gatewayHardware', () => {
  it('finds the hardware address of the router in the neighbour table, in lower case', () => {
    expect(gatewayHardware(laptopNeighbourTable, '192.168.1.1', 'wlp2s0')).toBe(
      'a4:91:b1:0c:7e:11',
    );
  });

  it.each([
    ['a router the table does not list', '192.168.1.254', 'wlp2s0'],
    ['the router seen on another interface', '192.168.1.1', 'enp3s0'],
    ['an entry still being resolved', '192.168.1.60', 'wlp2s0'],
  ])('finds nothing for %s', (_, gateway, interfaceName) => {
    expect(
      gatewayHardware(laptopNeighbourTable, gateway, interfaceName),
    ).toBeUndefined();
  });

  it('finds nothing in an empty table', () => {
    expect(gatewayHardware('', '192.168.1.1', 'wlp2s0')).toBeUndefined();
  });
});

describe('subnetOf', () => {
  it.each([
    ['192.168.1.20', '255.255.255.0', '192.168.1.20/24', '192.168.1.0/24'],
    ['10.20.30.40', '255.0.0.0', '10.20.30.40/8', '10.0.0.0/8'],
    ['172.16.5.9', '255.255.240.0', '172.16.5.9/20', '172.16.0.0/20'],
    ['192.168.1.20', '255.255.255.255', '192.168.1.20/32', '192.168.1.20/32'],
  ])(
    'reads %s with the mask %s as the network %s',
    (address, mask, cidr, subnet) => {
      expect(subnetOf(address, mask, cidr)).toBe(subnet);
    },
  );

  it.each([
    ['192.168.1.20', '255.255.255.0', '192.168.1.20'],
    ['192.168.1.20', '255.255.255.0', '192.168.1.20/33'],
    ['192.168.1.20', '0.0.0.0', '192.168.1.20/0'],
    ['fe80::1', 'ffff:ffff:ffff:ffff::', 'fe80::1/64'],
  ])('reads no network from %s with %s as %s', (address, mask, cidr) => {
    expect(subnetOf(address, mask, cidr)).toBeUndefined();
  });
});

const wifiRoute = {
  interfaceName: 'wlp2s0',
  metric: 600,
  gateway: '192.168.1.1',
};

describe('localNetwork', () => {
  it('is the private IPv4 network of the physical interface that carries the default route, with its router', () => {
    expect(localNetwork(laptop, [wifiRoute], laptopNeighbourTable)).toEqual({
      interfaceName: 'wlp2s0',
      subnet: '192.168.1.0/24',
      gateway: '192.168.1.1',
      gatewayHardware: 'a4:91:b1:0c:7e:11',
      address: '192.168.1.20',
    });
  });

  it('leaves the router hardware unknown when the neighbour table does not have it yet', () => {
    expect(localNetwork(laptop, [wifiRoute], '')).toEqual({
      interfaceName: 'wlp2s0',
      subnet: '192.168.1.0/24',
      gateway: '192.168.1.1',
      address: '192.168.1.20',
    });
  });

  it.each(['tun0', 'docker0', 'br-5c1e0d2a9f3b', 'virbr0', 'tailscale0'])(
    'is never the network of the virtual interface %s, even when it carries the default route',
    (interfaceName) => {
      expect(
        localNetwork(
          laptop,
          [{ interfaceName, metric: 0, gateway: '10.8.0.1' }],
          laptopNeighbourTable,
        ),
      ).toBeUndefined();
    },
  );

  it('passes over a VPN that takes the default route to the physical network behind it', () => {
    expect(
      localNetwork(
        laptop,
        [{ interfaceName: 'tun0', metric: 50, gateway: '10.8.0.1' }, wifiRoute],
        laptopNeighbourTable,
      )?.interfaceName,
    ).toBe('wlp2s0');
  });

  it('is nothing without a default route', () => {
    expect(localNetwork(laptop, [], laptopNeighbourTable)).toBeUndefined();
  });

  it('is nothing when the default route leads to a public address', () => {
    expect(
      localNetwork(
        [address('eth0', '203.0.113.5/24', { physical: true })],
        [{ interfaceName: 'eth0', metric: 100, gateway: '203.0.113.1' }],
        '',
      ),
    ).toBeUndefined();
  });

  it('is nothing when the interface reports no prefix length', () => {
    expect(
      localNetwork(
        [address('eth0', '192.168.1.20', { physical: true, cidr: undefined })],
        [{ interfaceName: 'eth0', metric: 100, gateway: '192.168.1.1' }],
        '',
      ),
    ).toBeUndefined();
  });
});

describe('sameNetwork', () => {
  const home = {
    interfaceName: 'wlp2s0',
    subnet: '192.168.1.0/24',
    gateway: '192.168.1.1',
    gatewayHardware: 'a4:91:b1:0c:7e:11',
  };

  it('is the same network when the interface, the subnet and the router match', () => {
    const here = { ...home, address: '192.168.1.44' };
    expect(sameNetwork(home, here)).toBe(true);
  });

  it.each([
    [
      'a café Wi-Fi with the same subnet and router address but another router',
      { ...home, gatewayHardware: '10:20:30:40:50:60' },
    ],
    ['another subnet', { ...home, subnet: '192.168.0.0/24' }],
    ['another interface', { ...home, interfaceName: 'enp3s0' }],
    ['another router address', { ...home, gateway: '192.168.1.254' }],
    [
      'a router whose hardware is not known',
      { ...home, gatewayHardware: undefined },
    ],
  ])('is another network for %s', (_, other) => {
    expect(sameNetwork(home, other)).toBe(false);
  });

  it('is never the same network when the recorded one has no router hardware', () => {
    const recorded = { ...home, gatewayHardware: undefined };
    expect(sameNetwork(recorded, recorded)).toBe(false);
  });

  it('is another network when nothing is recorded or the computer is on none', () => {
    expect(sameNetwork(home, undefined)).toBe(false);
    expect(sameNetwork(undefined, home)).toBe(false);
  });
});
