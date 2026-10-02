import { describe, expect, it } from 'vitest';
import { macNetworkOutput } from '../../../spec/fixtures/mac-network-output.ts';
import {
  macDefaultRoute,
  macDefaultRoutes,
  macPhysicalInterface,
  macPrimaryService,
} from './mac-network-output.ts';

const router = {
  interfaceName: 'en0',
  metric: 0,
  gateway: '192.168.1.1',
};

describe('Mac network output', () => {
  it('reads the default IPv4 route captured on this Mac', () => {
    expect(macDefaultRoute(macNetworkOutput.route)).toEqual({
      gateway: '192.168.1.1',
      interfaceName: 'en0',
    });
  });

  it('finds the primary network service macOS keeps in its configuration store', () => {
    expect(macPrimaryService(macNetworkOutput.global)).toBe(
      '284F6FA8-57FC-4F51-A638-5DBFB0A66DE6',
    );
    expect(macPrimaryService('<dictionary> {\n}\n')).toBeUndefined();
  });

  it('reads the default route with the router hardware address macOS resolved for the primary service', () => {
    expect(
      macDefaultRoutes(macNetworkOutput.route, macNetworkOutput.service),
    ).toEqual([{ ...router, gatewayHardware: '02:00:5e:10:00:01' }]);
  });

  it('pads the hardware octets macOS prints without their leading zero', () => {
    expect(
      macDefaultRoutes(
        macNetworkOutput.route,
        macNetworkOutput.service.replace(
          'ARPResolvedHardwareAddress : 02:00:5e:10:00:01',
          'ARPResolvedHardwareAddress : 2:0:5e:10:0:1',
        ),
      ),
    ).toEqual([{ ...router, gatewayHardware: '02:00:5e:10:00:01' }]);
  });

  it.each([
    [
      'macOS has not resolved its hardware address',
      macNetworkOutput.service.replace(
        /\s*ARPResolvedHardwareAddress : \S+\n/,
        '\n',
      ),
    ],
    [
      'macOS resolved an empty hardware address',
      macNetworkOutput.service.replace(
        'ARPResolvedHardwareAddress : 02:00:5e:10:00:01',
        'ARPResolvedHardwareAddress : 0:0:0:0:0:0',
      ),
    ],
    [
      'the primary service resolved another router',
      macNetworkOutput.service.replace(
        'ARPResolvedIPAddress : 192.168.1.1',
        'ARPResolvedIPAddress : 192.168.1.254',
      ),
    ],
    [
      'the primary service is on another interface',
      macNetworkOutput.service.replace(
        'InterfaceName : en0\n  NetworkSignature',
        'InterfaceName : en7\n  NetworkSignature',
      ),
    ],
    ['no primary service was read', ''],
  ])('leaves the router hardware unknown while %s', (_, service) => {
    expect(macDefaultRoutes(macNetworkOutput.route, service)).toEqual([router]);
  });

  it('reads no default route without an active default IPv4 route, and the route once one is active', () => {
    expect(macDefaultRoutes('', macNetworkOutput.service)).toEqual([]);
    expect(
      macDefaultRoutes(macNetworkOutput.route, macNetworkOutput.service),
    ).toEqual([
      {
        interfaceName: 'en0',
        metric: 0,
        gateway: '192.168.1.1',
        gatewayHardware: '02:00:5e:10:00:01',
      },
    ]);
  });

  it.each([
    '',
    'unreadable',
    macNetworkOutput.route.replace('192.168.1.1', 'fe80::1%en0'),
    macNetworkOutput.route.replace('192.168.1.1', '999.168.1.1'),
    macNetworkOutput.route.replace('<UP,', '<'),
    macNetworkOutput.route.replace(
      'destination: default',
      'destination: 192.168.1',
    ),
  ])(
    'refuses an absent, inactive or malformed default IPv4 route, unlike the active one captured on this Mac: %s',
    (output) => {
      expect(macDefaultRoute(output)).toBeUndefined();
      expect(macDefaultRoute(macNetworkOutput.route)).toEqual({
        gateway: '192.168.1.1',
        interfaceName: 'en0',
      });
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
