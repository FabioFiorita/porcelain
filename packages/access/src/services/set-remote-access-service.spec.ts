import { describe, expect, it } from 'vitest';
import {
  InvalidTunnelHostnameError,
  MissingTunnelHostnameError,
} from '@porcelain/access/errors';
import { FixedRuntimeStatusReader } from '../../spec/fakes/fixed-runtime-status-reader.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { SetRemoteAccessService } from './set-remote-access-service.ts';

const serviceUrl = 'http://127.0.0.1:4173';

function setup() {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const service = new SetRemoteAccessService(
    settings,
    routes,
    new FixedRuntimeStatusReader({
      address: serviceUrl,
      dataDirectory: '/data',
      pid: 1,
    }),
    { hostnameLength: 253 },
  );
  return { settings, routes, service };
}

describe('SetRemoteAccessService', () => {
  it('saves a route turned on and shows it starting until it is opened', () => {
    const { settings, service } = setup();

    expect(service.execute({ lan: true })).toEqual({
      routes: {
        lan: { enabled: true, status: { kind: 'starting' } },
        tailnet: { enabled: false, status: { kind: 'off' } },
        cloudflare: { enabled: false, status: { kind: 'off' } },
      },
      serviceUrl,
    });
    expect(settings.read()).toEqual({
      lan: true,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('keeps a route that is turned off in its current state until it is closed', () => {
    const { routes, service } = setup();
    service.execute({ tailnet: true });
    const open = { kind: 'on' as const, urls: ['http://100.64.0.9:4173'] };
    routes.save({
      states: { ...routes.read().states, tailnet: open },
      origins: open.urls,
    });

    expect(service.execute({ tailnet: false }).routes.tailnet).toEqual({
      enabled: false,
      status: open,
    });
    expect(routes.read().origins).toEqual(open.urls);
  });

  it('checks the tunnel again when Cloudflare is turned on again or its hostname changes', () => {
    const { routes, service } = setup();
    service.execute({ cloudflare: true, cloudflareHostname: 'a.example.com' });
    routes.save({
      states: {
        ...routes.read().states,
        cloudflare: { kind: 'failed', reason: 'unreachable' },
      },
      origins: [],
    });

    expect(service.execute({ cloudflare: true }).routes.cloudflare).toEqual({
      enabled: true,
      status: { kind: 'starting' },
    });
    routes.save({
      states: {
        ...routes.read().states,
        cloudflare: { kind: 'on', urls: ['https://a.example.com'] },
      },
      origins: ['https://a.example.com'],
    });
    expect(
      service.execute({ cloudflareHostname: 'b.example.com' }),
    ).toMatchObject({
      routes: { cloudflare: { enabled: true, status: { kind: 'starting' } } },
      cloudflareHostname: 'b.example.com',
    });
    expect(routes.read().origins).toEqual([]);
  });

  it('refuses to turn Cloudflare on without a hostname and changes nothing', () => {
    const { settings, service } = setup();

    expect(() => service.execute({ lan: true, cloudflare: true })).toThrow(
      MissingTunnelHostnameError,
    );
    expect(settings.read()).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('refuses a hostname that is not a public HTTPS hostname and changes nothing', () => {
    const { settings, service } = setup();

    expect(() =>
      service.execute({
        cloudflare: true,
        cloudflareHostname: 'porcelain.example.com/review',
      }),
    ).toThrow(InvalidTunnelHostnameError);
    expect(settings.read().cloudflareHostname).toBeUndefined();
  });
});
