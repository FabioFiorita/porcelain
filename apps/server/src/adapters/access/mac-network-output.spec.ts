import { describe, expect, it } from 'vitest';
import { macNetworkOutput } from '../../../spec/fixtures/mac-network-output.ts';
import {
  macDefaultRoute,
  macRouteTable,
  macNeighbourTable,
  macPhysicalInterface,
} from './mac-network-output.ts';

describe('Mac network output', () => {
  it('reads the default IPv4 route captured on this Mac', () => {
    expect(macDefaultRoute(macNetworkOutput.route)).toEqual({
      gateway: '192.168.15.1',
      interfaceName: 'en0',
    });
    expect(macRouteTable(macNetworkOutput.route)).toBe(
      'Iface Destination Gateway Flags RefCnt Use Metric Mask\nen0 00000000 010fa8c0 0003 0 0 0 00000000',
    );
  });

  it('reads the router hardware address captured on this Mac', () => {
    expect(macNeighbourTable(macNetworkOutput.neighbour)).toBe(
      'IP address HW type Flags HW address Mask Device\n192.168.15.1 0x1 0x2 e8:45:8b:b8:eb:80 * en0',
    );
  });

  it('pads the hardware octets macOS prints without their leading zero', () => {
    expect(
      macNeighbourTable(
        macNetworkOutput.neighbour.replace(
          'e8:45:8b:b8:eb:80',
          '2:0:5e:10:0:1',
        ),
      ),
    ).toBe(
      'IP address HW type Flags HW address Mask Device\n192.168.15.1 0x1 0x2 02:00:5e:10:00:01 * en0',
    );
  });

  it('leaves the router unknown while ARP resolution is incomplete', () => {
    expect(
      macNeighbourTable(
        macNetworkOutput.neighbour.replace('e8:45:8b:b8:eb:80', '(incomplete)'),
      ),
    ).toBe('IP address HW type Flags HW address Mask Device');
  });

  it.each([
    '',
    'unreadable',
    macNetworkOutput.route.replace('192.168.15.1', 'fe80::1%en0'),
    macNetworkOutput.route.replace('192.168.15.1', '999.168.15.1'),
    macNetworkOutput.route.replace('<UP,', '<'),
    macNetworkOutput.route.replace(
      'destination: default',
      'destination: 192.168.15',
    ),
  ])(
    'refuses an absent, inactive or malformed default IPv4 route: %s',
    (output) => {
      expect(macDefaultRoute(output)).toBeUndefined();
    },
  );

  it.each(['en0', 'en4', 'en10'])(
    'recognises a physical macOS interface: %s',
    (name) => {
      expect(macPhysicalInterface(name)).toBe(true);
    },
  );

  it.each([
    'lo0',
    'utun4',
    'bridge0',
    'awdl0',
    'llw0',
    'vmenet0',
    'en0/escape',
  ])('excludes a virtual or malformed interface: %s', (name) => {
    expect(macPhysicalInterface(name)).toBe(false);
  });
});
