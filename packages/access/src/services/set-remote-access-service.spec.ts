import {
  RemoteAccessStore,
  RouteStateStore,
  RuntimeStatusReader,
  NetworkAddressReader,
  RemoteAccessOptions,
} from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  UnidentifiedLocalNetworkError,
} from '@porcelain/access/errors';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedRuntimeStatusReader } from '../../spec/fakes/fixed-runtime-status-reader.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import {
  HOME_ROUTER_HARDWARE,
  routesVia,
} from '../../spec/fixtures/default-routes.ts';
import { SetRemoteAccessService } from './set-remote-access-service.ts';

const serviceUrl = 'http://127.0.0.1:4173';
const tailnetHostname = 'laptop.tail0000.ts.net';
const router = {
  gateway: '192.168.1.1',
  gatewayHardware: HOME_ROUTER_HARDWARE,
};
const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24', ...router };
const office = { interfaceName: 'wlp2s0', subnet: '10.20.0.0/16', ...router };

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
    routesVia('wlp2s0', HOME_ROUTER_HARDWARE),
  );
  const service = Effect.runSync(
    SetRemoteAccessService.pipe(
      Effect.provide(SetRemoteAccessService.layer),
      Effect.provideService(RemoteAccessStore, settings),
      Effect.provideService(RouteStateStore, routes),
      Effect.provideService(
        RuntimeStatusReader,
        new FixedRuntimeStatusReader({
          address: serviceUrl,
          dataDirectory: '/data',
          pid: 1,
        }),
      ),
      Effect.provideService(NetworkAddressReader, network),
      Effect.provideService(RemoteAccessOptions, { hostnameLength: 253 }),
    ),
  );
  return { settings, routes, network, service };
}

describe('SetRemoteAccessService', () => {
  it('saves a route turned on and shows it starting until it is opened', async () => {
    const { settings, service } = setup();

    expect(await Effect.runPromise(service.execute({ lan: true }))).toEqual({
      routes: {
        lan: { enabled: true, status: { kind: 'starting' } },
        tailnet: { enabled: false, status: { kind: 'off' } },
        cloudflare: { enabled: false, status: { kind: 'off' } },
      },
      lanNetwork: home,
      localNetwork: home,
      serviceUrl,
    });
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: true,
      lanNetwork: home,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('turns the local network on for the network the computer is on now, which a second turn-on replaces', async () => {
    const { settings, network, service } = setup();
    await Effect.runPromise(service.execute({ lan: true }));
    network.replace([wifi('10.20.30.40/16')]);

    expect(
      await Effect.runPromise(
        service.execute({ tailnet: true, tailnetHostname }),
      ),
    ).toMatchObject({
      lanNetwork: home,
      localNetwork: office,
    });
    expect(
      await Effect.runPromise(service.execute({ lan: true })),
    ).toMatchObject({
      routes: { lan: { enabled: true, status: { kind: 'starting' } } },
      lanNetwork: office,
      localNetwork: office,
    });
    expect((await Effect.runPromise(settings.read())).lanNetwork).toEqual(
      office,
    );
  });

  it('forgets the network when the local network is turned off', async () => {
    const { settings, service } = setup();
    await Effect.runPromise(service.execute({ lan: true }));
    const view = await Effect.runPromise(service.execute({ lan: false }));

    expect(view.lanNetwork).toBeUndefined();
    expect(view.localNetwork).toEqual(home);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('refuses to turn the local network on while it cannot read the hardware address of the router, and changes nothing', async () => {
    const { settings, network, service } = setup();
    network.replace([wifi('192.168.1.20/24')], routesVia('wlp2s0'));

    await expect(
      Effect.runPromise(service.execute({ lan: true })),
    ).rejects.toThrow(UnidentifiedLocalNetworkError);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('refuses to turn the local network on while the computer is on no local network, and changes nothing', async () => {
    const { settings, network, service } = setup();
    network.replace([wifi('192.168.1.20/24')], []);

    await expect(
      Effect.runPromise(
        service.execute({ lan: true, tailnet: true, tailnetHostname }),
      ),
    ).rejects.toThrow(NoLocalNetworkError);
    await expect(
      Effect.runPromise(service.execute({ lan: true })),
    ).rejects.toThrow(NoLocalNetworkError);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('keeps a route that is turned off in its current state until it is closed', async () => {
    const { routes, service } = setup();
    await Effect.runPromise(
      service.execute({ tailnet: true, tailnetHostname }),
    );
    const open = { kind: 'on' as const, urls: ['http://100.64.0.9:4173'] };
    routes.save({
      states: { ...routes.read().states, tailnet: open },
      origins: open.urls,
    });

    expect(
      (await Effect.runPromise(service.execute({ tailnet: false }))).routes
        .tailnet,
    ).toEqual({
      enabled: false,
      status: open,
    });
    expect(routes.read().origins).toEqual(open.urls);
  });

  it('names the listener to forward Tailscale Serve to once the tailnet listens, and checks the name again when the tailnet is turned on again or its name changes', async () => {
    const { routes, service } = setup();
    await Effect.runPromise(
      service.execute({ tailnet: true, tailnetHostname }),
    );
    const failed = { kind: 'failed' as const, reason: 'unreachable' as const };
    routes.save({
      states: { ...routes.read().states, tailnet: failed },
      origins: [],
      tailnetProxy: {
        hostname: tailnetHostname,
        address: '127.0.0.1',
        port: 41000,
      },
    });

    expect(
      await Effect.runPromise(service.execute({ tailnet: true })),
    ).toMatchObject({
      routes: { tailnet: { enabled: true, status: { kind: 'starting' } } },
      tailnetHostname,
      tailnetTarget: 'http://127.0.0.1:41000',
    });
    routes.save({
      ...routes.read(),
      states: { ...routes.read().states, tailnet: failed },
    });
    expect(
      (
        await Effect.runPromise(
          service.execute({ tailnetHostname: 'desk.tail0000.ts.net' }),
        )
      ).routes.tailnet.status,
    ).toEqual({ kind: 'starting' });
  });

  it('refuses a Tailscale name outside ts.net and turning the tailnet on without one, changing nothing', async () => {
    const { settings, service } = setup();

    await expect(
      Effect.runPromise(
        service.execute({ tailnet: true, tailnetHostname: 'a.example.com' }),
      ),
    ).rejects.toThrow(InvalidTailnetHostnameError);
    await expect(
      Effect.runPromise(service.execute({ tailnet: true })),
    ).rejects.toThrow(MissingTailnetHostnameError);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('keeps knowing the listener Tailscale Serve forwards to while another route changes', async () => {
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
    await Effect.runPromise(service.execute({ lan: true }));

    expect(routes.read().tailnetProxy).toEqual(tailnetProxy);
  });

  it('checks the tunnel again when Cloudflare is turned on again or its hostname changes', async () => {
    const { routes, service } = setup();
    await Effect.runPromise(
      service.execute({
        cloudflare: true,
        cloudflareHostname: 'a.example.com',
      }),
    );
    routes.save({
      states: {
        ...routes.read().states,
        cloudflare: { kind: 'failed', reason: 'unreachable' },
      },
      origins: [],
    });

    expect(
      (await Effect.runPromise(service.execute({ cloudflare: true }))).routes
        .cloudflare,
    ).toEqual({
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
      await Effect.runPromise(
        service.execute({ cloudflareHostname: 'b.example.com' }),
      ),
    ).toMatchObject({
      routes: { cloudflare: { enabled: true, status: { kind: 'starting' } } },
      cloudflareHostname: 'b.example.com',
    });
    expect(routes.read().origins).toEqual([]);
  });

  it('refuses to turn Cloudflare on without a hostname and changes nothing', async () => {
    const { settings, service } = setup();

    await expect(
      Effect.runPromise(service.execute({ tailnet: true, cloudflare: true })),
    ).rejects.toThrow(MissingTunnelHostnameError);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('refuses a hostname that is not a public HTTPS hostname and changes nothing', async () => {
    const { settings, service } = setup();

    await expect(
      Effect.runPromise(
        service.execute({
          cloudflare: true,
          cloudflareHostname: 'porcelain.example.com/review',
        }),
      ),
    ).rejects.toThrow(InvalidTunnelHostnameError);
    expect(
      (await Effect.runPromise(settings.read())).cloudflareHostname,
    ).toBeUndefined();
  });
});
