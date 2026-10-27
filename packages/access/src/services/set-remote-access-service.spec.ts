import {
  DeviceStore,
  RemoteAccessStore,
  RouteStateStore,
  RuntimeStatusReader,
  NetworkAddressReader,
  RemoteAccessOptions,
} from '@porcelain/access/ports';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  InvalidTailnetHostnameError,
  InvalidTunnelHostnameError,
  MissingTailnetHostnameError,
  MissingTunnelHostnameError,
  NoLocalNetworkError,
  UnidentifiedLocalNetworkError,
  RemoteRouteInUseError,
  WaysInChangedError,
  WaysInPermissionRequiredError,
} from '@porcelain/access/errors';
import type { StoredDevice, WaysInCaller } from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedRuntimeStatusReader } from '../../spec/fakes/fixed-runtime-status-reader.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import {
  HOME_ROUTER_HARDWARE,
  routesVia,
} from '../../spec/fixtures/default-routes.ts';
import type { RemoteAccessChange } from '../models/remote-access.ts';
import { AuthorizeWaysInService } from './authorize-ways-in-service.ts';
import { ReadRemoteAccessService } from './read-remote-access-service.ts';
import { SetRemoteAccessService } from './set-remote-access-service.ts';

const serviceUrl = 'http://127.0.0.1:4173';
const tailnetHostname = 'laptop.tail0000.ts.net';
const router = {
  gateway: '192.168.1.1',
  gatewayHardware: HOME_ROUTER_HARDWARE,
};
const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24', ...router };
const office = { interfaceName: 'wlp2s0', subnet: '10.20.0.0/16', ...router };
const owner: WaysInCaller = {
  viewer: { kind: 'owner' },
  local: true,
  route: 'loopback',
};
const phone: StoredDevice = {
  id: 'phone',
  label: 'Phone',
  platform: 'iOS',
  createdAt: '2026-10-20T10:00:00.000Z',
  lastSeenAt: '2026-10-25T09:00:00.000Z',
  route: 'lan',
  secretHash: 'hash-phone',
  canEditWaysIn: true,
};
const phoneOnLan: WaysInCaller = {
  viewer: { kind: 'device', deviceId: phone.id },
  local: false,
  route: 'lan',
};

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
  const devices = new InMemoryDeviceStore();
  devices.add(phone);
  const network = new FixedNetworkAddressReader(
    [wifi('192.168.1.20/24')],
    routesVia('wlp2s0', HOME_ROUTER_HARDWARE),
  );
  const services = Effect.runSync(
    Effect.all({
      set: SetRemoteAccessService,
      read: ReadRemoteAccessService,
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          SetRemoteAccessService.layer,
          ReadRemoteAccessService.layer,
        ).pipe(Layer.provide(AuthorizeWaysInService.layer)),
      ),
      Effect.provideService(DeviceStore, devices),
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
  const service = {
    execute: (change: RemoteAccessChange) =>
      services.read.execute().pipe(
        Effect.flatMap(({ fingerprint }) =>
          services.set.execute({
            expected: fingerprint,
            change,
            caller: owner,
          }),
        ),
        Effect.map(({ remote }) => remote),
      ),
  };
  return { settings, routes, devices, network, service, services };
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

  it('refuses a save made from an older look at the ways in, and changes nothing', async () => {
    const { settings, routes, services } = setup();
    const before = await Effect.runPromise(services.read.execute());
    await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change: { tailnet: true, tailnetHostname },
        caller: owner,
      }),
    );
    const saved = await Effect.runPromise(settings.read());
    const states = routes.read();

    await expect(
      Effect.runPromise(
        services.set.execute({
          expected: before.fingerprint,
          change: { lan: true },
          caller: owner,
        }),
      ),
    ).rejects.toThrow(WaysInChangedError);
    expect(await Effect.runPromise(settings.read())).toEqual(saved);
    expect(routes.read()).toEqual(states);
  });

  it('refuses to turn the local network on after the computer moved to another network since the last look', async () => {
    const { settings, network, services } = setup();
    const before = await Effect.runPromise(services.read.execute());
    network.replace([wifi('10.20.30.40/16')]);

    await expect(
      Effect.runPromise(
        services.set.execute({
          expected: before.fingerprint,
          change: { lan: true },
          caller: owner,
        }),
      ),
    ).rejects.toThrow(WaysInChangedError);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
  });

  it('answers a repeated save, sent again while its route is still starting, with the current ways in instead of a conflict', async () => {
    const { settings, routes, services } = setup();
    const before = await Effect.runPromise(services.read.execute());
    const change = { tailnet: true, tailnetHostname };
    const first = await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change,
        caller: owner,
      }),
    );
    const saved = await Effect.runPromise(settings.read());
    const states = routes.read();

    const repeated = await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change,
        caller: owner,
      }),
    );

    expect(first.applied).toBe(true);
    expect(repeated).toEqual({ ...first, applied: false });
    expect(await Effect.runPromise(settings.read())).toEqual(saved);
    expect(routes.read()).toBe(states);
  });

  it('checks a failed route again even though its settings stay the same', async () => {
    const { routes, services } = setup();
    const before = await Effect.runPromise(services.read.execute());
    const saved = await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change: { tailnet: true, tailnetHostname },
        caller: owner,
      }),
    );
    routes.save({
      states: {
        ...routes.read().states,
        tailnet: { kind: 'failed', reason: 'unreachable' },
      },
      origins: [],
    });

    const again = await Effect.runPromise(
      services.set.execute({
        expected: saved.fingerprint,
        change: { tailnet: true },
        caller: owner,
      }),
    );

    expect(again.applied).toBe(true);
    expect(again.fingerprint).toBe(saved.fingerprint);
    expect(again.remote.routes.tailnet.status).toEqual({ kind: 'starting' });
  });

  it('answers a save from an older look that would also be invalid now with the conflict, not with a validation error about settings it never saw', async () => {
    const { services } = setup();
    const before = await Effect.runPromise(services.read.execute());
    await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change: { cloudflare: true, cloudflareHostname: 'a.example.com' },
        caller: owner,
      }),
    );

    await expect(
      Effect.runPromise(
        services.set.execute({
          expected: before.fingerprint,
          change: { tailnet: true },
          caller: owner,
        }),
      ),
    ).rejects.toThrow(WaysInChangedError);
  });

  it.each([
    ['turning it on', { lan: true }],
    [
      'turning it on with another route',
      { lan: true, tailnet: true, tailnetHostname },
    ],
  ])(
    'refuses %s for the way in the device is connected through, and changes nothing',
    async (_name, change) => {
      const { settings, services } = setup();
      const before = await Effect.runPromise(services.read.execute());

      await expect(
        Effect.runPromise(
          services.set.execute({
            expected: before.fingerprint,
            change,
            caller: phoneOnLan,
          }),
        ),
      ).rejects.toThrow(RemoteRouteInUseError);
      expect(await Effect.runPromise(settings.read())).toEqual({
        lan: false,
        tailnet: false,
        cloudflare: false,
      });
    },
  );

  it.each([
    [
      'its permission was removed',
      (devices: InMemoryDeviceStore) =>
        devices.recordWaysInPermission({ device: phone, allowed: false }),
    ],
    [
      'it was revoked',
      (devices: InMemoryDeviceStore) =>
        devices.markRevoked({
          device: phone,
          revokedAt: '2026-10-25T10:00:00.000Z',
        }),
    ],
  ])(
    'refuses a save from a device after %s since it looked, whether or not it changes anything, and changes nothing',
    async (_name, withdraw) => {
      const { settings, devices, services } = setup();
      const before = await Effect.runPromise(services.read.execute());
      await Effect.runPromise(withdraw(devices));

      for (const change of [
        { tailnet: true, tailnetHostname },
        { cloudflare: false },
      ])
        await expect(
          Effect.runPromise(
            services.set.execute({
              expected: before.fingerprint,
              change,
              caller: phoneOnLan,
            }),
          ),
        ).rejects.toThrow(WaysInPermissionRequiredError);
      expect(await Effect.runPromise(settings.read())).toEqual({
        lan: false,
        tailnet: false,
        cloudflare: false,
      });
    },
  );

  it('saves another way in for a device connected through the local network', async () => {
    const { settings, services } = setup();
    const before = await Effect.runPromise(services.read.execute());

    const saved = await Effect.runPromise(
      services.set.execute({
        expected: before.fingerprint,
        change: { tailnet: true, tailnetHostname },
        caller: phoneOnLan,
      }),
    );

    expect(saved.applied).toBe(true);
    expect(await Effect.runPromise(settings.read())).toEqual({
      lan: false,
      tailnet: true,
      tailnetHostname,
      cloudflare: false,
    });
  });
});
