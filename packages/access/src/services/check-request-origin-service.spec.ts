import { RemoteAccessStore, RouteStateStore } from '@porcelain/access/ports';
import { Effect } from 'effect';
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
  return Effect.runSync(
    Effect.runSync(
      CheckRequestOriginService.pipe(
        Effect.provide(CheckRequestOriginService.layer),
        Effect.provideService(RemoteAccessStore, settings),
        Effect.provideService(RouteStateStore, routes),
      ),
    ).execute({
      host: tunnelHost,
      origin: `https://${tunnelHost}`,
      method: 'POST',
      scheme: 'http',
      localAddress: '127.0.0.1',
      localPort: 4173,
      allowedHosts: [],
      requireSameOrigin: false,
      crossOrigin: 'refused',
      credential: 'none',
    }),
  );
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
    expect(checkThroughTunnel(cloudflare)).toEqual({
      kind: 'allowed',
      crossOrigin: false,
    });
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

  it('answers the Tailscale name only on the listener Tailscale Serve forwards to, as an HTTPS origin, and refuses it on any other listener or once that listener is gone', () => {
    const settings = new InMemoryRemoteAccessStore();
    const hostname = 'laptop.tail0000.ts.net';
    settings.save({
      lan: false,
      tailnet: true,
      tailnetHostname: hostname,
      cloudflare: false,
    });
    const routes = new InMemoryRouteStateStore();
    const on = {
      states: {
        lan: { kind: 'off' as const },
        tailnet: { kind: 'on' as const, urls: [`https://${hostname}`] },
        cloudflare: { kind: 'off' as const },
      },
      origins: [`https://${hostname}`],
      tailnetProxy: { hostname, address: '127.0.0.1', port: 41000 },
    };
    routes.save(on);
    const service = Effect.runSync(
      CheckRequestOriginService.pipe(
        Effect.provide(CheckRequestOriginService.layer),
        Effect.provideService(RemoteAccessStore, settings),
        Effect.provideService(RouteStateStore, routes),
      ),
    );
    const write = (origin: string, localPort = 41000) =>
      Effect.runSync(
        service.execute({
          host: hostname,
          origin,
          method: 'POST',
          scheme: 'http',
          localAddress: '127.0.0.1',
          localPort,
          allowedHosts: [],
          requireSameOrigin: false,
          crossOrigin: 'refused',
          credential: 'none',
        }),
      );
    const notAnswered = {
      kind: 'refused',
      refusal: { kind: 'host-not-allowed', hostname },
    };

    expect(write(`https://${hostname}`)).toEqual({
      kind: 'allowed',
      crossOrigin: false,
    });
    expect(write(`http://${hostname}`)).toEqual({
      kind: 'refused',
      refusal: { kind: 'cross-origin', origin: `http://${hostname}` },
    });
    expect(write(`https://${hostname}`, 4173)).toEqual(notAnswered);
    routes.save({ ...on, tailnetProxy: undefined });
    expect(write(`https://${hostname}`)).toEqual(notAnswered);
  });
});
