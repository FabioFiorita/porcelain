import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedTunnelProbe } from '../../spec/fakes/fixed-tunnel-probe.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteListenerRunner } from '../../spec/fakes/in-memory-route-listener-runner.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { FixedRouteListenerRunner } from '../../spec/fakes/fixed-route-listener-runner.ts';
import {
  laptopNeighbourTable,
  neighbourTableWith,
  routeTableVia,
} from '../../spec/fixtures/route-table.ts';
import { OpenRemoteRoutesService } from './open-remote-routes-service.ts';

const environmentId = 'environment-here';
const signal: AbortSignal = { aborted: false, reason: undefined };

function address(
  interfaceName: string,
  cidr: string,
  physical = false,
): NetworkAddress {
  const [value = ''] = cidr.split('/');
  return {
    interfaceName,
    address: value,
    family: value.includes(':') ? 'IPv6' : 'IPv4',
    internal: false,
    physical,
    netmask: cidr.endsWith('/16') ? '255.255.0.0' : '255.255.255.0',
    cidr,
  };
}

const machine = [
  address('wlp2s0', '192.168.1.20/24', true),
  address('docker0', '172.17.0.1/16'),
  address('virbr0', '192.168.122.1/24'),
  address('tun0', '10.8.0.51/24'),
  address('tailscale0', '100.64.0.9/32'),
];
const home = {
  interfaceName: 'wlp2s0',
  subnet: '192.168.1.0/24',
  gateway: '192.168.1.1',
  gatewayHardware: 'a4:91:b1:0c:7e:11',
};
const lanAtHome = {
  lan: true,
  lanNetwork: home,
  tailnet: false,
  cloudflare: false,
};

function setup(options: { refusing?: boolean } = {}) {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const addresses = new FixedNetworkAddressReader(
    machine,
    routeTableVia('wlp2s0'),
    laptopNeighbourTable,
  );
  const listeners = new InMemoryRouteListenerRunner(4173, 41000, []);
  const probe = new FixedTunnelProbe({ kind: 'answered', environmentId });
  const service = new OpenRemoteRoutesService(
    settings,
    routes,
    addresses,
    options.refusing
      ? new FixedRouteListenerRunner(4173, 'address-in-use')
      : listeners,
    probe,
    { loopbackAddress: '127.0.0.1' },
  );
  const open = () => service.execute({ environmentId }, signal);
  const close = () => service.execute({ environmentId, closing: true }, signal);
  return { settings, routes, addresses, listeners, probe, open, close };
}

const tailnetName = 'laptop.tail0000.ts.net';
const tailnetOnly = {
  lan: false,
  tailnet: true,
  tailnetHostname: tailnetName,
  cloudflare: false,
};

describe('OpenRemoteRoutesService', () => {
  it('keeps every route off and listens nowhere while nothing is turned on', async () => {
    const { routes, listeners, open } = setup();
    await open();

    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'off' },
        tailnet: { kind: 'off' },
        cloudflare: { kind: 'off' },
      },
      origins: [],
    });
    expect(listeners.bound({ route: 'lan' })).toEqual([]);
  });

  it('listens on the local network only at its address on the network it was turned on for, never on Docker, libvirt or VPN interfaces', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save(lanAtHome);
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual(['192.168.1.20']);
    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
        tailnet: { kind: 'off' },
        cloudflare: { kind: 'off' },
      },
      origins: ['http://192.168.1.20:4173'],
    });
  });

  it('answers the tailnet through a loopback listener of its own once this server answers at the Tailscale name, records its port and offers the name for pairing', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save(tailnetOnly);
    await open();

    expect(listeners.bound({ route: 'tailnet' })).toEqual(['127.0.0.1']);
    expect(settings.read().tailnetPort).toBe(41000);
    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'off' },
        tailnet: { kind: 'on', urls: [`https://${tailnetName}`] },
        cloudflare: { kind: 'off' },
      },
      origins: [`https://${tailnetName}`],
      tailnetProxy: {
        hostname: tailnetName,
        address: '127.0.0.1',
        port: 41000,
      },
    });
  });

  it('listens on its recorded port again after a restart, so the forward the owner set up in Tailscale keeps working', async () => {
    const { settings, routes, open } = setup();
    settings.save({ ...tailnetOnly, tailnetPort: 39000 });
    await open();

    expect(settings.read().tailnetPort).toBe(39000);
    expect(routes.read().tailnetProxy).toEqual({
      hostname: tailnetName,
      address: '127.0.0.1',
      port: 39000,
    });
  });

  it.each([
    [{ kind: 'unreachable' } as const, 'unreachable'],
    [
      { kind: 'answered', environmentId: 'somewhere-else' } as const,
      'other-server',
    ],
    [{ kind: 'foreign' } as const, 'other-server'],
  ])(
    'fails the tailnet when the Tailscale name answers %j, keeping its listener for the forward the owner has yet to set up',
    async (answer, reason) => {
      const { settings, routes, listeners, probe, open } = setup();
      probe.replace(answer);
      settings.save(tailnetOnly);
      await open();

      expect(routes.read()).toEqual({
        states: {
          lan: { kind: 'off' },
          tailnet: { kind: 'failed', reason },
          cloudflare: { kind: 'off' },
        },
        origins: [],
        tailnetProxy: {
          hostname: tailnetName,
          address: '127.0.0.1',
          port: 41000,
        },
      });
      expect(listeners.bound({ route: 'tailnet' })).toEqual(['127.0.0.1']);
    },
  );

  it('fails the tailnet without asking its name when another program holds its recorded port, keeping the port it told the owner', async () => {
    const { settings, routes, open } = setup({ refusing: true });
    settings.save({ ...tailnetOnly, tailnetPort: 39000 });
    await open();

    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'off' },
        tailnet: { kind: 'failed', reason: 'address-in-use' },
        cloudflare: { kind: 'off' },
      },
      origins: [],
    });
    expect(settings.read().tailnetPort).toBe(39000);
  });

  it('keeps a checked tailnet as it was until its settings change, rather than asking again on every pass', async () => {
    const { settings, routes, probe, open } = setup();
    settings.save(tailnetOnly);
    await open();
    probe.replace({ kind: 'unreachable' });
    await open();

    expect(routes.read().states.tailnet).toEqual({
      kind: 'on',
      urls: [`https://${tailnetName}`],
    });
  });

  it('asks the Tailscale name again on every pass while it fails, showing the failure meanwhile, and turns the tailnet on once it answers', async () => {
    const { settings, routes, probe, open } = setup();
    probe.replace({ kind: 'unreachable' });
    settings.save(tailnetOnly);
    await open();
    await open();
    expect(routes.read().states.tailnet).toEqual({
      kind: 'failed',
      reason: 'unreachable',
    });

    probe.replace({ kind: 'answered', environmentId });
    await open();
    expect(routes.read().states.tailnet).toEqual({
      kind: 'on',
      urls: [`https://${tailnetName}`],
    });
  });

  it('stops listening for Tailscale when the tailnet is turned off', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save(tailnetOnly);
    await open();
    settings.save({ ...settings.read(), tailnet: false });
    await open();

    expect(listeners.bound({ route: 'tailnet' })).toEqual([]);
    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'off' },
        tailnet: { kind: 'off' },
        cloudflare: { kind: 'off' },
      },
      origins: [],
    });
  });

  it('closes every route when the server stops, keeping what the owner turned on', async () => {
    const { settings, routes, listeners, open, close } = setup();
    settings.save({ ...lanAtHome, ...tailnetOnly, lan: true });
    await open();
    await close();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(listeners.bound({ route: 'tailnet' })).toEqual([]);
    expect(settings.read()).toEqual({
      ...lanAtHome,
      ...tailnetOnly,
      lan: true,
      tailnetPort: 41000,
    });
    expect(routes.read().origins).toEqual([]);
  });

  it('follows a new address the computer gets on the same network', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    await open();
    addresses.replace([address('wlp2s0', '192.168.1.44/24', true)]);
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual(['192.168.1.44']);
    expect(routes.read().states.lan).toEqual({
      kind: 'on',
      urls: ['http://192.168.1.44:4173'],
    });
  });

  it('pauses on another network, listening nowhere and offering nothing for pairing, and listens again back on its own network', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    await open();

    addresses.replace([address('wlp2s0', '10.0.0.7/24', true)]);
    await open();
    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read()).toMatchObject({
      states: { lan: { kind: 'paused' } },
      origins: [],
    });

    addresses.replace(machine);
    await open();
    expect(listeners.bound({ route: 'lan' })).toEqual(['192.168.1.20']);
  });

  it('pauses on a network with the same addresses reached through another interface', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    addresses.replace(
      [address('enp3s0', '192.168.1.20/24', true)],
      routeTableVia('enp3s0'),
    );
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read().states.lan).toEqual({ kind: 'paused' });
  });

  it('pauses on a café network with the same interface, subnet and router address but another router', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    addresses.replace(
      machine,
      routeTableVia('wlp2s0'),
      neighbourTableWith('192.168.1.1', '10:20:30:40:50:60', 'wlp2s0'),
    );
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read().states.lan).toEqual({ kind: 'paused' });
  });

  it('pauses while it cannot read the hardware address of the router, rather than guess the network', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    addresses.replace(machine, routeTableVia('wlp2s0'), '');
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read().states.lan).toEqual({ kind: 'paused' });
  });

  it('pauses while the computer is on no network', async () => {
    const { settings, routes, addresses, listeners, open } = setup();
    settings.save(lanAtHome);
    addresses.replace(machine, '');
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read().states.lan).toEqual({ kind: 'paused' });
  });

  it('pauses a local network that was turned on before its network was recorded', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save({ lan: true, tailnet: false, cloudflare: false });
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read().states.lan).toEqual({ kind: 'paused' });
  });

  it('stops listening on a route that was turned off', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save(lanAtHome);
    await open();
    settings.save({ lan: false, tailnet: false, cloudflare: false });
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(routes.read()).toMatchObject({
      states: { lan: { kind: 'off' } },
      origins: [],
    });
  });

  it('fails a route with the reason its addresses could not be bound', async () => {
    const { settings, routes, open } = setup({ refusing: true });
    settings.save(lanAtHome);
    await open();

    expect(routes.read().states.lan).toEqual({
      kind: 'failed',
      reason: 'address-in-use',
    });
  });

  it('turns Cloudflare on once this server answers through the tunnel hostname', async () => {
    const { settings, routes, open } = setup();
    settings.save({
      lan: false,
      tailnet: false,
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    });
    await open();

    expect(routes.read()).toMatchObject({
      states: {
        cloudflare: { kind: 'on', urls: ['https://porcelain.example.com'] },
      },
      origins: ['https://porcelain.example.com'],
    });
  });

  it('fails Cloudflare when another server or nothing answers at the hostname', async () => {
    const { settings, routes, probe, open } = setup();
    settings.save({
      lan: false,
      tailnet: false,
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    });
    probe.replace({ kind: 'answered', environmentId: 'somewhere-else' });
    await open();
    expect(routes.read().states.cloudflare).toEqual({
      kind: 'failed',
      reason: 'other-server',
    });

    routes.save({
      states: { ...routes.read().states, cloudflare: { kind: 'starting' } },
      origins: [],
    });
    probe.replace({ kind: 'unreachable' });
    await open();
    expect(routes.read().states.cloudflare).toEqual({
      kind: 'failed',
      reason: 'unreachable',
    });
  });

  it('keeps a checked tunnel as it was until its settings change, rather than asking again on every pass', async () => {
    const { settings, routes, probe, open } = setup();
    settings.save({
      lan: false,
      tailnet: false,
      cloudflare: true,
      cloudflareHostname: 'porcelain.example.com',
    });
    await open();
    probe.replace({ kind: 'unreachable' });
    await open();

    expect(routes.read().states.cloudflare).toEqual({
      kind: 'on',
      urls: ['https://porcelain.example.com'],
    });
  });
});
