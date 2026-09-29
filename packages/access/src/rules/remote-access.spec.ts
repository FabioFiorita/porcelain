import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import {
  changedRemoteAccess,
  listenedState,
  reachableOrigins,
  tailnetAddresses,
  tunnelHostname,
  tunnelHosts,
  tunnelState,
} from './remote-access.ts';

function address(
  interfaceName: string,
  value: string,
  extra: Partial<NetworkAddress> = {},
): NetworkAddress {
  return {
    interfaceName,
    address: value,
    family: value.includes(':') ? 'IPv6' : 'IPv4',
    internal: false,
    physical: false,
    ...extra,
  };
}

const laptop = [
  address('lo', '127.0.0.1', { internal: true }),
  address('lo', '::1', { internal: true }),
  address('wlp2s0', '192.168.1.20'),
  address('wlp2s0', 'fe80::1c2d:3eff:fe4f:5a6b'),
  address('enp3s0', '10.0.0.7'),
  address('docker0', '172.17.0.1'),
  address('tailscale0', '100.101.102.103'),
  address('tailscale0', 'fd7a:115c:a1e0::1234:5678'),
];

describe('tailnetAddresses', () => {
  it('finds the tailnet IPv4 and IPv6 addresses, IPv4 first', () => {
    expect(tailnetAddresses([...laptop].reverse())).toEqual([
      '100.101.102.103',
      'fd7a:115c:a1e0::1234:5678',
    ]);
  });

  it('recognises Tailscale by its IPv6 prefix when the interface has another name', () => {
    expect(
      tailnetAddresses([
        address('utun4', '100.64.0.9'),
        address('utun4', 'fd7a:115c:a1e0::9'),
      ]),
    ).toEqual(['100.64.0.9', 'fd7a:115c:a1e0::9']);
  });

  it('does not take a carrier-grade NAT address on another interface for a tailnet address', () => {
    expect(tailnetAddresses([address('wwan0', '100.72.10.4')])).toEqual([]);
  });

  it('finds nothing when Tailscale is not running', () => {
    expect(tailnetAddresses(laptop.slice(0, 6))).toEqual([]);
  });
});

describe('tunnelHostname', () => {
  it.each([
    ['porcelain.example.com', 'porcelain.example.com'],
    ['  Porcelain.Example.COM. ', 'porcelain.example.com'],
    ['https://porcelain.example.com', 'porcelain.example.com'],
    ['https://porcelain.example.com/', 'porcelain.example.com'],
  ])('reads %j as the hostname %s', (value, hostname) => {
    expect(tunnelHostname(value, 253)).toBe(hostname);
  });

  it.each([
    ['plain HTTP', 'http://porcelain.example.com'],
    ['a path', 'porcelain.example.com/review'],
    ['a port', 'porcelain.example.com:8443'],
    ['a query', 'https://porcelain.example.com/?next=1'],
    ['credentials', 'user@porcelain.example.com'],
    ['a single label', 'porcelain'],
    ['an IPv4 address', '203.0.113.5'],
    ['an IPv6 address', '[2001:db8::1]'],
    ['a bad label', 'porcelain_.example.com'],
    ['nothing', '   '],
  ])('refuses a hostname with %s', (_, value) => {
    expect(tunnelHostname(value, 253)).toBeUndefined();
  });

  it('refuses a hostname longer than the limit', () => {
    expect(tunnelHostname('porcelain.example.com', 20)).toBeUndefined();
    expect(tunnelHostname('porcelain.example.com', 21)).toBe(
      'porcelain.example.com',
    );
  });
});

describe('changedRemoteAccess', () => {
  const off = { lan: false, tailnet: false, cloudflare: false };

  const here = {
    interfaceName: 'wlp2s0',
    subnet: '192.168.1.0/24',
    address: '192.168.1.20',
  };
  const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };

  it('changes only the routes the request names', () => {
    expect(
      changedRemoteAccess(
        { ...off, tailnet: true, cloudflareHostname: 'a.example.com' },
        { lan: true },
        253,
        here,
      ),
    ).toEqual({
      kind: 'settings',
      settings: {
        lan: true,
        lanNetwork: home,
        tailnet: true,
        cloudflare: false,
        cloudflareHostname: 'a.example.com',
      },
    });
  });

  it('keeps the network the local network was turned on for while other routes change, wherever the computer is now', () => {
    expect(
      changedRemoteAccess(
        { ...off, lan: true, lanNetwork: home },
        { tailnet: true },
        253,
        undefined,
      ),
    ).toEqual({
      kind: 'settings',
      settings: { ...off, lan: true, lanNetwork: home, tailnet: true },
    });
  });

  it('refuses to turn the local network on without a network to turn it on for', () => {
    expect(changedRemoteAccess(off, { lan: true }, 253, undefined)).toEqual({
      kind: 'no-local-network',
    });
  });

  it('turns Cloudflare on with the hostname it names, written the canonical way', () => {
    expect(
      changedRemoteAccess(
        off,
        { cloudflare: true, cloudflareHostname: 'https://Review.Example.com/' },
        253,
      ),
    ).toEqual({
      kind: 'settings',
      settings: {
        ...off,
        cloudflare: true,
        cloudflareHostname: 'review.example.com',
      },
    });
  });

  it('keeps the saved hostname when Cloudflare is turned off', () => {
    expect(
      changedRemoteAccess(
        { ...off, cloudflare: true, cloudflareHostname: 'a.example.com' },
        { cloudflare: false },
        253,
      ),
    ).toEqual({
      kind: 'settings',
      settings: { ...off, cloudflareHostname: 'a.example.com' },
    });
  });

  it('refuses to turn Cloudflare on without a hostname', () => {
    expect(changedRemoteAccess(off, { cloudflare: true }, 253)).toEqual({
      kind: 'missing-hostname',
    });
  });

  it('refuses a hostname it cannot read, even while Cloudflare stays off', () => {
    expect(
      changedRemoteAccess(
        off,
        { cloudflareHostname: 'http://a.example.com' },
        253,
      ),
    ).toEqual({ kind: 'invalid-hostname' });
  });
});

describe('listenedState', () => {
  it('is on at every bound address, with IPv6 addresses in brackets', () => {
    expect(
      listenedState(['100.64.0.9', 'fd7a:115c:a1e0::9'], {
        port: 4173,
        bound: ['100.64.0.9', 'fd7a:115c:a1e0::9'],
      }),
    ).toEqual({
      kind: 'on',
      urls: ['http://100.64.0.9:4173', 'http://[fd7a:115c:a1e0::9]:4173'],
    });
  });

  it('stays on when only some addresses could be bound', () => {
    expect(
      listenedState(['192.168.1.20', '10.0.0.7'], {
        port: 4173,
        bound: ['10.0.0.7'],
        failure: 'address-in-use',
      }),
    ).toEqual({ kind: 'on', urls: ['http://10.0.0.7:4173'] });
  });

  it('fails for want of an address when the machine has none for the route', () => {
    expect(listenedState([], { port: 4173, bound: [] })).toEqual({
      kind: 'failed',
      reason: 'no-address',
    });
  });

  it('fails with the reason the listener gave when nothing could be bound', () => {
    expect(
      listenedState(['192.168.1.20'], {
        port: 4173,
        bound: [],
        failure: 'address-in-use',
      }),
    ).toEqual({ kind: 'failed', reason: 'address-in-use' });
  });
});

describe('tunnelState', () => {
  const origin = 'https://porcelain.example.com';

  it('is on when this server answers through the tunnel', () => {
    expect(
      tunnelState({ kind: 'answered', environmentId: 'here' }, 'here', origin),
    ).toEqual({ kind: 'on', urls: [origin] });
  });

  it('fails when another server answers at the hostname', () => {
    expect(
      tunnelState({ kind: 'answered', environmentId: 'else' }, 'here', origin),
    ).toEqual({ kind: 'failed', reason: 'other-server' });
  });

  it('fails when something that is not Porcelain answers at the hostname', () => {
    expect(tunnelState({ kind: 'foreign' }, 'here', origin)).toEqual({
      kind: 'failed',
      reason: 'other-server',
    });
  });

  it('fails when nothing answers at the hostname', () => {
    expect(tunnelState({ kind: 'unreachable' }, 'here', origin)).toEqual({
      kind: 'failed',
      reason: 'unreachable',
    });
  });
});

describe('tunnelHosts', () => {
  it('accepts the tunnel hostname only while Cloudflare is on', () => {
    const hostname = 'porcelain.example.com';
    expect(
      tunnelHosts({
        lan: false,
        tailnet: false,
        cloudflare: true,
        cloudflareHostname: hostname,
      }),
    ).toEqual([hostname]);
    expect(
      tunnelHosts({
        lan: false,
        tailnet: false,
        cloudflare: false,
        cloudflareHostname: hostname,
      }),
    ).toEqual([]);
  });
});

describe('reachableOrigins', () => {
  it('lists the addresses of the routes that are on and nothing else', () => {
    expect(
      reachableOrigins({
        lan: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
        tailnet: { kind: 'failed', reason: 'no-address' },
        cloudflare: { kind: 'paused' },
      }),
    ).toEqual(['http://192.168.1.20:4173']);
  });
});
