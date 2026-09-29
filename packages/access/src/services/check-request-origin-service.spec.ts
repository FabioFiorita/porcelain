import { describe, expect, it } from 'vitest';
import type { RouteState } from '@porcelain/access/models';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { CheckRequestOriginService } from './check-request-origin-service.ts';

const tunnelHost = 'porcelain.example.com';

function checkThroughTunnel(cloudflare: RouteState, enabled = true) {
  const settings = new InMemoryRemoteAccessStore();
  settings.save({
    lan: false,
    tailnet: false,
    cloudflare: enabled,
    cloudflareHostname: tunnelHost,
  });
  const routes = new InMemoryRouteStateStore();
  routes.save({
    states: { lan: { kind: 'off' }, tailnet: { kind: 'off' }, cloudflare },
    origins: [],
  });
  return new CheckRequestOriginService(settings, routes).execute({
    host: tunnelHost,
    origin: `https://${tunnelHost}`,
    method: 'POST',
    scheme: 'http',
    localAddress: '127.0.0.1',
    allowedHosts: [],
    requireSameOrigin: false,
  });
}

describe('CheckRequestOriginService', () => {
  it.each<[string, RouteState]>([
    ['before the first check', { kind: 'off' }],
    ['while the tunnel is being checked', { kind: 'starting' }],
    ['once the tunnel reaches this server', { kind: 'on', urls: [] }],
    [
      'while nothing answers at the hostname yet',
      { kind: 'failed', reason: 'unreachable' },
    ],
  ])('answers the tunnel hostname %s', (_moment, cloudflare) => {
    expect(checkThroughTunnel(cloudflare)).toEqual({ kind: 'allowed' });
  });

  it('refuses the tunnel hostname once the check found another server behind it', () => {
    expect(
      checkThroughTunnel({ kind: 'failed', reason: 'other-server' }),
    ).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: tunnelHost },
    });
  });

  it('refuses the saved tunnel hostname while Cloudflare is off', () => {
    expect(checkThroughTunnel({ kind: 'off' }, false)).toEqual({
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname: tunnelHost },
    });
  });
});
