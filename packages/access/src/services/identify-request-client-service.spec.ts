import { describe, expect, it } from 'vitest';
import type {
  IdentifyRequestClientInput,
  RouteState,
} from '@porcelain/access/models';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { IdentifyRequestClientService } from './identify-request-client-service.ts';

const tunnelHost = 'porcelain.example.com';
const visitor = '203.0.113.7';

const tailnetProxy = {
  hostname: 'laptop.tail0000.ts.net',
  address: '127.0.0.1',
  port: 41000,
};

function identify(
  request: Partial<IdentifyRequestClientInput>,
  tunnel: { enabled?: boolean; state?: RouteState } = {},
) {
  const settings = new InMemoryRemoteAccessStore();
  settings.save({
    lan: false,
    tailnet: false,
    cloudflare: tunnel.enabled ?? true,
    cloudflareHostname: tunnelHost,
  });
  const routes = new InMemoryRouteStateStore();
  routes.save({
    states: {
      lan: { kind: 'off' },
      tailnet: { kind: 'off' },
      cloudflare: tunnel.state ?? { kind: 'on', urls: [] },
    },
    origins: [],
    tailnetProxy,
  });
  return new IdentifyRequestClientService(settings, routes).execute({
    host: tunnelHost,
    scheme: 'http',
    peerAddress: '127.0.0.1',
    localAddress: '127.0.0.1',
    localPort: 4173,
    connectingAddress: visitor,
    forwardedFor: undefined,
    ...request,
  });
}

describe('IdentifyRequestClientService', () => {
  it('takes a request for the tunnel hostname as secure and from the visitor Cloudflare names', () => {
    expect(identify({})).toEqual({
      route: 'tunnel',
      address: visitor,
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it('reads the tunnel hostname whatever its case and with its port', () => {
    expect(identify({ host: 'Porcelain.Example.com:443' })).toEqual({
      route: 'tunnel',
      address: visitor,
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it('reads an IPv6 visitor address', () => {
    expect(identify({ connectingAddress: '2001:DB8::7' }).address).toBe(
      '2001:db8::7',
    );
  });

  it('keeps the socket address when the tunnel hostname arrives from another machine', () => {
    expect(identify({ peerAddress: '192.168.1.30' })).toEqual({
      route: 'tunnel',
      address: '192.168.1.30',
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it.each(['porcelain.example.com', '203.0.113.7, 198.51.100.2', ''])(
    'keeps the socket address when the visitor address reads %j',
    (connectingAddress) => {
      expect(identify({ connectingAddress }).address).toBe('127.0.0.1');
    },
  );

  it('keeps the socket address when Cloudflare names no visitor', () => {
    expect(identify({ connectingAddress: undefined }).address).toBe(
      '127.0.0.1',
    );
  });

  it.each(['127.0.0.1:4173', '192.168.1.20:4173', undefined])(
    'never trusts a visitor address on a request for %s, which did not come through the tunnel',
    (host) => {
      expect(identify({ host })).toEqual({
        route: 'loopback',
        address: '127.0.0.1',
        secure: false,
      });
    },
  );

  it('does not take the saved hostname for the tunnel while Cloudflare is off', () => {
    expect(identify({}, { enabled: false })).toEqual({
      route: 'loopback',
      address: '127.0.0.1',
      secure: false,
    });
  });

  it('does not take the hostname for the tunnel once another server answers there', () => {
    expect(
      identify({}, { state: { kind: 'failed', reason: 'other-server' } }),
    ).toEqual({ route: 'loopback', address: '127.0.0.1', secure: false });
  });

  it('takes the hostname for the tunnel while the tunnel is being checked', () => {
    expect(identify({}, { state: { kind: 'starting' } })).toEqual({
      route: 'tunnel',
      address: visitor,
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it('takes a request that arrived over HTTPS as secure', () => {
    expect(identify({ host: '127.0.0.1:4173', scheme: 'https' })).toEqual({
      route: 'loopback',
      address: '127.0.0.1',
      secure: true,
    });
  });

  it.each([tunnelHost, '192.168.1.20:4173'])(
    'takes a request that reached a listener at a private address as the local network, even for %s',
    (host) => {
      expect(
        identify({
          host,
          localAddress: '192.168.1.20',
          peerAddress: '192.168.1.30',
        }),
      ).toEqual({ route: 'lan', address: '192.168.1.30', secure: false });
    },
  );

  it('reads the listener address in its IPv4-mapped form', () => {
    expect(
      identify({ host: undefined, localAddress: '::ffff:127.0.0.1' }).route,
    ).toBe('loopback');
    expect(
      identify({ localAddress: '::ffff:192.168.1.20', peerAddress: '::1' })
        .route,
    ).toBe('lan');
  });

  it.each(['100.101.102.103', 'fd7a:115c:a1e0::1'])(
    'takes a request that reached a listener at the tailnet address %s as the tailnet',
    (localAddress) => {
      expect(
        identify({ localAddress, peerAddress: '100.64.0.9', host: tunnelHost }),
      ).toEqual({ route: 'tailnet', address: '100.64.0.9', secure: false });
    },
  );

  it('takes a request whose listener address is unknown as the local network', () => {
    expect(identify({ localAddress: undefined }).route).toBe('lan');
  });

  it('takes a request on the loopback listener Tailscale Serve forwards to as the tailnet, secure, from the tailnet address it names', () => {
    expect(
      identify({
        host: tailnetProxy.hostname,
        localPort: tailnetProxy.port,
        forwardedFor: '100.64.0.9',
      }),
    ).toEqual({ route: 'tailnet', address: '100.64.0.9', secure: true });
  });

  it('takes the Serve listener as the tailnet whatever host the request names', () => {
    expect(
      identify({ localPort: tailnetProxy.port, forwardedFor: undefined }),
    ).toEqual({ route: 'tailnet', address: '127.0.0.1', secure: true });
  });

  it.each(['100.64.0.9, 203.0.113.7', 'laptop', ''])(
    'keeps the socket address when Serve names the client as %j',
    (forwardedFor) => {
      expect(
        identify({ localPort: tailnetProxy.port, forwardedFor }).address,
      ).toBe('127.0.0.1');
    },
  );

  it('never trusts a forwarded address on the main loopback listener', () => {
    expect(
      identify({
        host: tailnetProxy.hostname,
        forwardedFor: '100.64.0.9',
      }),
    ).toEqual({ route: 'loopback', address: '127.0.0.1', secure: false });
  });

  it('does not take a listener at another address on the same port for the Serve listener', () => {
    expect(
      identify({
        localAddress: '192.168.1.20',
        localPort: tailnetProxy.port,
        peerAddress: '192.168.1.30',
      }).route,
    ).toBe('lan');
  });
});
