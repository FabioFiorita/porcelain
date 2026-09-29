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
  });
  return new IdentifyRequestClientService(settings, routes).execute({
    host: tunnelHost,
    scheme: 'http',
    peerAddress: '127.0.0.1',
    connectingAddress: visitor,
    ...request,
  });
}

describe('IdentifyRequestClientService', () => {
  it('takes a request for the tunnel hostname as secure and from the visitor Cloudflare names', () => {
    expect(identify({})).toEqual({
      address: visitor,
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it('reads the tunnel hostname whatever its case and with its port', () => {
    expect(identify({ host: 'Porcelain.Example.com:443' })).toEqual({
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
        address: '127.0.0.1',
        secure: false,
      });
    },
  );

  it('does not take the saved hostname for the tunnel while Cloudflare is off', () => {
    expect(identify({}, { enabled: false })).toEqual({
      address: '127.0.0.1',
      secure: false,
    });
  });

  it('does not take the hostname for the tunnel once another server answers there', () => {
    expect(
      identify({}, { state: { kind: 'failed', reason: 'other-server' } }),
    ).toEqual({ address: '127.0.0.1', secure: false });
  });

  it('takes the hostname for the tunnel while the tunnel is being checked', () => {
    expect(identify({}, { state: { kind: 'starting' } })).toEqual({
      address: visitor,
      secure: true,
      tunnelHostname: tunnelHost,
    });
  });

  it('takes a request that arrived over HTTPS as secure', () => {
    expect(identify({ host: '127.0.0.1:4173', scheme: 'https' })).toEqual({
      address: '127.0.0.1',
      secure: true,
    });
  });
});
