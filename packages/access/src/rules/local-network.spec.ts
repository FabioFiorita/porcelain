import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import {
  fullTunnelVpnRouteTable,
  laptopRouteTable,
} from '../../spec/fixtures/route-table.ts';
import {
  defaultRoutes,
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
      { interfaceName: 'wlp2s0', metric: 600 },
    ]);
  });

  it('lists every default route, the preferred one first, when a VPN takes the default route', () => {
    expect(defaultRoutes(fullTunnelVpnRouteTable)).toEqual([
      { interfaceName: 'tun0', metric: 50 },
      { interfaceName: 'wlp2s0', metric: 600 },
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

describe('localNetwork', () => {
  it('is the private IPv4 network of the physical interface that carries the default route', () => {
    expect(
      localNetwork(laptop, [{ interfaceName: 'wlp2s0', metric: 600 }]),
    ).toEqual({
      interfaceName: 'wlp2s0',
      subnet: '192.168.1.0/24',
      address: '192.168.1.20',
    });
  });

  it.each(['tun0', 'docker0', 'br-5c1e0d2a9f3b', 'virbr0', 'tailscale0'])(
    'is never the network of the virtual interface %s, even when it carries the default route',
    (interfaceName) => {
      expect(localNetwork(laptop, [{ interfaceName, metric: 0 }])).toBe(
        undefined,
      );
    },
  );

  it('passes over a VPN that takes the default route to the physical network behind it', () => {
    expect(
      localNetwork(laptop, [
        { interfaceName: 'tun0', metric: 50 },
        { interfaceName: 'wlp2s0', metric: 600 },
      ])?.interfaceName,
    ).toBe('wlp2s0');
  });

  it('is nothing without a default route', () => {
    expect(localNetwork(laptop, [])).toBeUndefined();
  });

  it('is nothing when the default route leads to a public address', () => {
    expect(
      localNetwork(
        [address('eth0', '203.0.113.5/24', { physical: true })],
        [{ interfaceName: 'eth0', metric: 100 }],
      ),
    ).toBeUndefined();
  });

  it('is nothing when the interface reports no prefix length', () => {
    expect(
      localNetwork(
        [address('eth0', '192.168.1.20', { physical: true, cidr: undefined })],
        [{ interfaceName: 'eth0', metric: 100 }],
      ),
    ).toBeUndefined();
  });
});

describe('sameNetwork', () => {
  const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };

  it('is the same network when the interface and the subnet match', () => {
    const here = { ...home, address: '192.168.1.44' };
    expect(sameNetwork(home, here)).toBe(true);
  });

  it.each([
    { interfaceName: 'wlp2s0', subnet: '192.168.0.0/24' },
    { interfaceName: 'enp3s0', subnet: '192.168.1.0/24' },
    undefined,
  ])('is another network for %j', (other) => {
    expect(sameNetwork(home, other)).toBe(false);
  });
});
