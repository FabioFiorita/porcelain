import { describe, expect, it } from 'vitest';
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

  it('keeps the Tailscale Serve target Porcelain set until the routes stop serving it', () => {
    const target = 'http://127.0.0.1:41000';
    expect(
      changedRemoteAccess(
        { ...off, tailnet: true, tailnetServeTarget: target },
        { tailnet: false },
        253,
      ),
    ).toEqual({
      kind: 'settings',
      settings: { ...off, tailnetServeTarget: target },
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
    cloudflare: true,
    cloudflareHostname: 'porcelain.example.com',
  };
  const on = { kind: 'on' as const, urls: [] };

  it('names the tunnel hostname and the tailnet name the proxy in front serves over HTTPS', () => {
    expect(
      httpsHosts(settings, {
        states: { lan: { kind: 'off' }, tailnet: on, cloudflare: on },
        origins: [],
        tailnetProxy: {
          hostname: 'laptop.tail0000.ts.net',
          address: '127.0.0.1',
          port: 41000,
        },
      }),
    ).toEqual(['porcelain.example.com', 'laptop.tail0000.ts.net']);
  });

  it('names no tailnet host while nothing serves the tailnet', () => {
    expect(
      httpsHosts(settings, {
        states: {
          lan: { kind: 'off' },
          tailnet: { kind: 'off' },
          cloudflare: on,
        },
        origins: [],
      }),
    ).toEqual(['porcelain.example.com']);
  });
});

describe('reachableOrigins', () => {
  it('lists the addresses of the routes that are on and nothing else', () => {
    expect(
      reachableOrigins({
        lan: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
        tailnet: { kind: 'failed', reason: 'tailscale-stopped' },
        cloudflare: { kind: 'paused' },
      }),
    ).toEqual(['http://192.168.1.20:4173']);
  });
});
