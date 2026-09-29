import { describe, expect, it } from 'vitest';
import type { NetworkAddress } from '@porcelain/access/models';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedTunnelProbe } from '../../spec/fakes/fixed-tunnel-probe.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteListenerRunner } from '../../spec/fakes/in-memory-route-listener-runner.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { FixedRouteListenerRunner } from '../../spec/fakes/fixed-route-listener-runner.ts';
import { OpenRemoteRoutesService } from './open-remote-routes-service.ts';

const environmentId = 'environment-here';
const signal: AbortSignal = { aborted: false, reason: undefined };

function address(interfaceName: string, value: string): NetworkAddress {
  return {
    interfaceName,
    address: value,
    family: value.includes(':') ? 'IPv6' : 'IPv4',
    internal: false,
  };
}

const machine = [
  address('wlp2s0', '192.168.1.20'),
  address('tailscale0', '100.64.0.9'),
];

function setup(
  options: {
    addresses?: NetworkAddress[];
    refusing?: boolean;
  } = {},
) {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const addresses = new FixedNetworkAddressReader(options.addresses ?? machine);
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

  it('listens on the local network and the tailnet at the addresses the machine has, and offers them for pairing', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save({ lan: true, tailnet: true, cloudflare: false });
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

  it('follows the addresses as the machine joins and leaves networks', async () => {
    const { settings, routes, addresses, listeners, open } = setup({
      addresses: [],
    });
    settings.save({ lan: true, tailnet: false, cloudflare: false });
    await open();
    expect(routes.read().states.lan).toEqual({
      kind: 'failed',
      reason: 'no-address',
    });

    addresses.replace([address('wlp2s0', '10.0.0.7')]);
    await open();
    expect(listeners.bound({ route: 'lan' })).toEqual(['10.0.0.7']);
    expect(routes.read().states.lan).toEqual({
      kind: 'on',
      urls: ['http://10.0.0.7:4173'],
    });
  });

  it('stops listening on a route that was turned off', async () => {
    const { settings, routes, listeners, open } = setup();
    settings.save({ lan: true, tailnet: false, cloudflare: false });
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
    settings.save({ lan: true, tailnet: false, cloudflare: false });
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
