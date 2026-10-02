import { describe, expect, it } from 'vitest';
import type { RouteState } from '@porcelain/access/models';
import {
  changedRemoteAccess,
  httpsHosts,
  listenedState,
  reachableOrigins,
  tunnelHostname,
  tunnelHosts,
  tunnelState,
} from './remote-access.ts';

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
    [
      'plain HTTP',
      'http://porcelain.example.com',
      'https://porcelain.example.com',
      'porcelain.example.com',
    ],
    [
      'a path',
      'porcelain.example.com/review',
      'porcelain.example.com/',
      'porcelain.example.com',
    ],
    [
      'a port',
      'porcelain.example.com:8443',
      'porcelain.example.com',
      'porcelain.example.com',
    ],
    [
      'a query',
      'https://porcelain.example.com/?next=1',
      'https://porcelain.example.com/',
      'porcelain.example.com',
    ],
    [
      'credentials',
      'user@porcelain.example.com',
      'user.porcelain.example.com',
      'user.porcelain.example.com',
    ],
    ['a single label', 'porcelain', 'porcelain.example', 'porcelain.example'],
    [
      'an IPv4 address',
      '203.0.113.5',
      '203.0.113.example',
      '203.0.113.example',
    ],
    ['an IPv6 address', '[2001:db8::1]', 'db8.example.com', 'db8.example.com'],
    [
      'a bad label',
      'porcelain_.example.com',
      'porcelain-x.example.com',
      'porcelain-x.example.com',
    ],
    ['nothing', '   ', ' a.b ', 'a.b'],
  ])(
    'refuses a hostname with %s, unlike its closest readable spelling',
    (_, value, closest, hostname) => {
      expect(tunnelHostname(value, 253)).toBeUndefined();
      expect(tunnelHostname(closest, 253)).toBe(hostname);
    },
  );

  it('refuses a hostname longer than the limit', () => {
    expect(tunnelHostname('porcelain.example.com', 20)).toBeUndefined();
    expect(tunnelHostname('porcelain.example.com', 21)).toBe(
      'porcelain.example.com',
    );
  });
});

describe('changedRemoteAccess', () => {
  const off = { lan: false, tailnet: false, cloudflare: false };

  const home = {
    interfaceName: 'wlp2s0',
    subnet: '192.168.1.0/24',
    gateway: '192.168.1.1',
    gatewayHardware: 'a4:91:b1:0c:7e:11',
  };
  const here = { ...home, address: '192.168.1.20' };

  const tailnet = {
    tailnet: true,
    tailnetHostname: 'laptop.tail0000.ts.net',
  };

  it('changes only the routes the request names', () => {
    expect(
      changedRemoteAccess(
        {
          ...off,
          ...tailnet,
          tailnetPort: 41000,
          cloudflareHostname: 'a.example.com',
        },
        { lan: true },
        253,
        here,
      ),
    ).toEqual({
      kind: 'settings',
      settings: {
        lan: true,
        lanNetwork: home,
        ...tailnet,
        tailnetPort: 41000,
        cloudflare: false,
        cloudflareHostname: 'a.example.com',
      },
    });
  });

  it('keeps the network the local network was turned on for while other routes change, wherever the computer is now', () => {
    expect(
      changedRemoteAccess(
        { ...off, lan: true, lanNetwork: home },
        tailnet,
        253,
        undefined,
      ),
    ).toEqual({
      kind: 'settings',
      settings: { ...off, lan: true, lanNetwork: home, ...tailnet },
    });
  });

  it("turns the tailnet on at this computer's Tailscale name, read in lower case", () => {
    expect(
      changedRemoteAccess(
        off,
        { tailnet: true, tailnetHostname: ' Laptop.Tail0000.ts.net ' },
        253,
      ),
    ).toEqual({ kind: 'settings', settings: { ...off, ...tailnet } });
  });

  it.each(['porcelain.example.com', 'laptop', 'https://laptop.ts.net:8443'])(
    'refuses %j as a Tailscale name, since Tailscale serves HTTPS only at a ts.net name',
    (tailnetHostname) => {
      expect(
        changedRemoteAccess(off, { tailnet: true, tailnetHostname }, 253),
      ).toEqual({ kind: 'invalid-tailnet-hostname' });
    },
  );

  it('refuses to turn the tailnet on without a Tailscale name', () => {
    expect(changedRemoteAccess(off, { tailnet: true }, 253)).toEqual({
      kind: 'missing-tailnet-hostname',
    });
  });

  it('forgets the listener port when the tailnet is turned off and keeps its name, so turning it on again picks a free port', () => {
    expect(
      changedRemoteAccess(
        { ...off, ...tailnet, tailnetPort: 41000 },
        { tailnet: false },
        253,
      ),
    ).toEqual({
      kind: 'settings',
      settings: { ...off, tailnetHostname: tailnet.tailnetHostname },
    });
  });

  it('refuses to turn the local network on for a network whose router it cannot identify', () => {
    const { gatewayHardware: _, ...unidentified } = here;
    expect(changedRemoteAccess(off, { lan: true }, 253, unidentified)).toEqual({
      kind: 'unidentified-local-network',
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
      listenedState({
        port: 4173,
        bound: ['192.168.1.20', 'fd00::9'],
      }),
    ).toEqual({
      kind: 'on',
      urls: ['http://192.168.1.20:4173', 'http://[fd00::9]:4173'],
    });
  });

  it('stays on when only some addresses could be bound', () => {
    expect(
      listenedState({
        port: 4173,
        bound: ['10.0.0.7'],
        failure: 'address-in-use',
      }),
    ).toEqual({ kind: 'on', urls: ['http://10.0.0.7:4173'] });
  });

  it('fails with the reason the listener gave when nothing could be bound', () => {
    expect(
      listenedState({ port: 4173, bound: [], failure: 'address-in-use' }),
    ).toEqual({ kind: 'failed', reason: 'address-in-use' });
    expect(listenedState({ port: 4173, bound: [] })).toEqual({
      kind: 'failed',
      reason: 'address-unavailable',
    });
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

describe('httpsHosts', () => {
  const settings = {
    lan: false,
    tailnet: true,
    tailnetHostname: 'laptop.tail0000.ts.net',
    cloudflare: true,
    cloudflareHostname: 'porcelain.example.com',
  };
  const on = { kind: 'on' as const, urls: [] };
  const routes = (tailnet: RouteState) => ({
    states: { lan: { kind: 'off' as const }, tailnet, cloudflare: on },
    origins: [],
    tailnetProxy: {
      hostname: 'laptop.tail0000.ts.net',
      address: '127.0.0.1',
      port: 41000,
    },
  });
  const throughTailnet = { localAddress: '127.0.0.1', localPort: 41000 };
  const mainListener = { localAddress: '127.0.0.1', localPort: 4173 };

  it.each<[string, RouteState]>([
    ['on', on],
    ['being checked', { kind: 'starting' }],
    ['unanswered', { kind: 'failed', reason: 'unreachable' }],
  ])(
    'names the tunnel hostname, and the Tailscale name for a request on the listener Tailscale forwards to while the tailnet is %s',
    (_, tailnet) => {
      expect(httpsHosts(settings, routes(tailnet), throughTailnet)).toEqual([
        'porcelain.example.com',
        'laptop.tail0000.ts.net',
      ]);
    },
  );

  it('names no Tailscale name for a request on any other listener, so a forward to the wrong port is never answered as the tailnet', () => {
    expect(httpsHosts(settings, routes(on), mainListener)).toEqual([
      'porcelain.example.com',
    ]);
  });

  it('names no Tailscale name while the tailnet has no listener', () => {
    expect(
      httpsHosts(
        settings,
        {
          states: {
            lan: { kind: 'off' },
            tailnet: { kind: 'off' },
            cloudflare: on,
          },
          origins: [],
        },
        throughTailnet,
      ),
    ).toEqual(['porcelain.example.com']);
  });
});

describe('reachableOrigins', () => {
  it('lists the addresses of the routes that are on and nothing else', () => {
    expect(
      reachableOrigins({
        lan: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
        tailnet: { kind: 'failed', reason: 'unreachable' },
        cloudflare: { kind: 'paused' },
      }),
    ).toEqual(['http://192.168.1.20:4173']);
  });
});
