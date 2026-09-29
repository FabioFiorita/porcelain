import { describe, expect, it } from 'vitest';
import {
  InvalidTunnelHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
} from '@porcelain/access/errors';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedRuntimeStatusReader } from '../../spec/fakes/fixed-runtime-status-reader.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { routeTableVia } from '../../spec/fixtures/route-table.ts';
import { SetRemoteAccessService } from './set-remote-access-service.ts';

const serviceUrl = 'http://127.0.0.1:4173';
const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };
const office = { interfaceName: 'wlp2s0', subnet: '10.20.0.0/16' };

function wifi(cidr: string) {
  const [address = ''] = cidr.split('/');
  return {
    interfaceName: 'wlp2s0',
    address,
    family: 'IPv4',
    internal: false,
    physical: true,
    netmask: cidr.endsWith('/16') ? '255.255.0.0' : '255.255.255.0',
    cidr,
  };
}

function setup() {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const network = new FixedNetworkAddressReader(
    [wifi('192.168.1.20/24')],
    routeTableVia('wlp2s0'),
  );
  const service = new SetRemoteAccessService(
    settings,
    routes,
    new FixedRuntimeStatusReader({
      address: serviceUrl,
      dataDirectory: '/data',
      pid: 1,
    }),
    network,
    { hostnameLength: 253 },
  );
  return { settings, routes, network, service };
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
      lanNetwork: home,
      localNetwork: home,
      serviceUrl,
    });
    expect(settings.read()).toEqual({
      lan: true,
      lanNetwork: home,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('turns the local network on for the network the computer is on now, which a second turn-on replaces', () => {
    const { settings, network, service } = setup();
    service.execute({ lan: true });
    network.replace([wifi('10.20.30.40/16')]);

    expect(service.execute({ tailnet: true })).toMatchObject({
      lanNetwork: home,
      localNetwork: office,
    });
    expect(service.execute({ lan: true })).toMatchObject({
      routes: { lan: { enabled: true, status: { kind: 'starting' } } },
      lanNetwork: office,
      localNetwork: office,
    });
    expect(settings.read().lanNetwork).toEqual(office);
  });

  it('forgets the network when the local network is turned off', () => {
    const { settings, service } = setup();
    service.execute({ lan: true });
    const view = service.execute({ lan: false });

    expect(view.lanNetwork).toBeUndefined();
    expect(view.localNetwork).toEqual(home);
    expect(settings.read()).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('refuses to turn the local network on while the computer is on no local network, and changes nothing', () => {
    const { settings, network, service } = setup();
    network.replace([wifi('192.168.1.20/24')], '');

    expect(() => service.execute({ lan: true, tailnet: true })).toThrow(
      NoLocalNetworkError,
    );
    expect(settings.read()).toEqual({
      lan: false,
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

  it('keeps knowing the listener Tailscale Serve forwards to while another route changes', () => {
    const { routes, service } = setup();
    const tailnetProxy = {
      hostname: 'laptop.tail0000.ts.net',
      address: '127.0.0.1',
      port: 41000,
    };
    const on = {
      kind: 'on' as const,
      urls: ['https://laptop.tail0000.ts.net'],
    };
    routes.save({
      states: { ...routes.read().states, tailnet: on },
      origins: on.urls,
      tailnetProxy,
    });
    service.execute({ lan: true });

    expect(routes.read().tailnetProxy).toEqual(tailnetProxy);
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

    expect(() => service.execute({ tailnet: true, cloudflare: true })).toThrow(
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
