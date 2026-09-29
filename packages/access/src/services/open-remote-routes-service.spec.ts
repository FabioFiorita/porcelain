import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedTunnelProbe } from '../../spec/fakes/fixed-tunnel-probe.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteListenerRunner } from '../../spec/fakes/in-memory-route-listener-runner.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { FixedRouteListenerRunner } from '../../spec/fakes/fixed-route-listener-runner.ts';
import { routeTableVia } from '../../spec/fixtures/route-table.ts';
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
const home = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };
const lanAtHome = {
  lan: true,
  lanNetwork: home,
  tailnet: false,
  cloudflare: false,
};

function setup(
  options: {
    addresses?: NetworkAddress[];
    refusing?: boolean;
  } = {},
) {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const addresses = new FixedNetworkAddressReader(
    options.addresses ?? machine,
    routeTableVia('wlp2s0'),
  );
  const listeners = new InMemoryRouteListenerRunner(4173);
  const probe = new FixedTunnelProbe({ kind: 'answered', environmentId });
  const service = new OpenRemoteRoutesService(
    settings,
    routes,
    addresses,
    options.refusing
      ? new FixedRouteListenerRunner(4173, 'address-in-use')
      : listeners,
    probe,
  );
  const open = () => service.execute({ environmentId }, signal);
  return { settings, routes, addresses, listeners, probe, open };
}

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

  it('listens on the local network only at its address on the network it was turned on for, never on Docker, libvirt or VPN interfaces, and on the tailnet', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save({ ...lanAtHome, tailnet: true });
    await open();

    expect(listeners.bound({ route: 'lan' })).toEqual(['192.168.1.20']);
    expect(listeners.bound({ route: 'tailnet' })).toEqual(['100.64.0.9']);
    expect(routes.read()).toEqual({
      states: {
        lan: { kind: 'on', urls: ['http://192.168.1.20:4173'] },
        tailnet: { kind: 'on', urls: ['http://100.64.0.9:4173'] },
        cloudflare: { kind: 'off' },
      },
      origins: ['http://192.168.1.20:4173', 'http://100.64.0.9:4173'],
    });
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
