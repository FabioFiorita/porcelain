import { describe, expect, it } from 'vitest';
import type {
  NetworkAddress,
  TailnetReport,
  TailnetServeOutcome,
  TailnetServing,
} from '@porcelain/access/models';
import { FixedNetworkAddressReader } from '../../spec/fakes/fixed-network-address-reader.ts';
import { FixedTunnelProbe } from '../../spec/fakes/fixed-tunnel-probe.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';
import { InMemoryRouteListenerRunner } from '../../spec/fakes/in-memory-route-listener-runner.ts';
import { InMemoryRouteStateStore } from '../../spec/fakes/in-memory-route-state-store.ts';
import { FixedTailnetServeRunner } from '../../spec/fakes/fixed-tailnet-serve-runner.ts';
import { FixedTailnetStatusReader } from '../../spec/fakes/fixed-tailnet-status-reader.ts';
import { InMemoryTailnet } from '../../spec/fakes/in-memory-tailnet.ts';
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
    serving?: TailnetServing;
    report?: TailnetReport;
    outcome?: TailnetServeOutcome;
  } = {},
) {
  const settings = new InMemoryRemoteAccessStore();
  const routes = new InMemoryRouteStateStore();
  const addresses = new FixedNetworkAddressReader(
    options.addresses ?? machine,
    routeTableVia('wlp2s0'),
  );
  const listeners = new InMemoryRouteListenerRunner(4173, 41000);
  const tailnet = new InMemoryTailnet(
    'Laptop.tail0000.ts.net.',
    options.serving,
  );
  const probe = new FixedTunnelProbe({ kind: 'answered', environmentId });
  const service = new OpenRemoteRoutesService(
    settings,
    routes,
    addresses,
    options.refusing
      ? new FixedRouteListenerRunner(4173, 'address-in-use')
      : listeners,
    options.report ? new FixedTailnetStatusReader(options.report) : tailnet,
    options.outcome ? new FixedTailnetServeRunner(options.outcome) : tailnet,
    probe,
    { loopbackAddress: '127.0.0.1' },
  );
  const open = () => service.execute({ environmentId }, signal);
  const close = () => service.execute({ environmentId, closing: true }, signal);
  return {
    settings,
    routes,
    addresses,
    listeners,
    tailnet,
    probe,
    open,
    close,
  };
}

const tailnetOnly = { lan: false, tailnet: true, cloudflare: false };
const tailnetName = 'laptop.tail0000.ts.net';
const ownListener = 'http://127.0.0.1:41000';

async function servingOf(tailnet: InMemoryTailnet) {
  const report = await tailnet.read();
  return report.kind === 'status' ? report.serving : undefined;
}

function nodeReport(
  node: { running?: boolean; https?: boolean; serving?: TailnetServing } = {},
): TailnetReport {
  return {
    kind: 'status',
    running: node.running ?? true,
    https: node.https ?? true,
    dnsName: 'Laptop.tail0000.ts.net.',
    serving: node.serving ?? { kind: 'nothing' },
  };
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

  it('serves the tailnet over HTTPS at the MagicDNS name through a loopback listener of its own, and offers that name for pairing', async () => {
    const { settings, routes, listeners, tailnet, open } = setup();
    settings.save(tailnetOnly);
    await open();

    expect(listeners.bound({ route: 'tailnet' })).toEqual(['127.0.0.1']);
    expect(await servingOf(tailnet)).toEqual({
      kind: 'proxy',
      target: ownListener,
    });
    expect(settings.read().tailnetServeTarget).toBe(ownListener);
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

  it('does not ask Tailscale to serve again while it already serves this listener', async () => {
    const { settings, routes, open } = setup({
      report: nodeReport({ serving: { kind: 'proxy', target: ownListener } }),
      outcome: { kind: 'failed' },
    });
    settings.save(tailnetOnly);
    await open();

    expect(routes.read().states.tailnet).toEqual({
      kind: 'on',
      urls: [`https://${tailnetName}`],
    });
  });

  it.each([
    [{ kind: 'missing' } as const, 'tailscale-missing'],
    [{ kind: 'unavailable' } as const, 'tailscale-unavailable'],
    [nodeReport({ running: false }), 'tailscale-stopped'],
    [nodeReport({ https: false }), 'https-disabled'],
  ])(
    'fails the tailnet when Tailscale reports %j with %s, listening and asking nothing',
    async (report, reason) => {
      const { settings, routes, listeners, open } = setup({
        report,
        outcome: { kind: 'failed' },
      });
      settings.save(tailnetOnly);
      await open();

      expect(routes.read()).toEqual({
        states: {
          lan: { kind: 'off' },
          tailnet: { kind: 'failed', reason },
          cloudflare: { kind: 'off' },
        },
        origins: [],
      });
      expect(listeners.bound({ route: 'tailnet' })).toEqual([]);
    },
  );

  it.each([
    ['denied', 'serve-denied'],
    ['failed', 'serve-failed'],
  ] as const)(
    'fails the tailnet when Tailscale Serve is %s, and records no target',
    async (outcome, reason) => {
      const { settings, routes, open } = setup({
        report: nodeReport(),
        outcome: { kind: outcome },
      });
      settings.save(tailnetOnly);
      await open();

      expect(routes.read().states.tailnet).toEqual({ kind: 'failed', reason });
      expect(routes.read().tailnetProxy).toBeUndefined();
      expect(settings.read().tailnetServeTarget).toBeUndefined();
    },
  );

  it('turns the tailnet on by itself once Tailscale is fixed', async () => {
    const { settings, routes, tailnet, open } = setup();
    settings.save(tailnetOnly);
    tailnet.change({ https: false });
    await open();
    tailnet.change({ https: true });
    await open();

    expect(routes.read().states.tailnet).toEqual({
      kind: 'on',
      urls: [`https://${tailnetName}`],
    });
  });

  it('leaves alone what someone else serves on the HTTPS port', async () => {
    const theirs = { kind: 'proxy' as const, target: 'http://127.0.0.1:3000' };
    const { settings, routes, tailnet, open } = setup({ serving: theirs });
    settings.save(tailnetOnly);
    await open();

    expect(routes.read().states.tailnet).toEqual({
      kind: 'failed',
      reason: 'serve-taken',
    });
    expect(await servingOf(tailnet)).toEqual(theirs);
  });

  it('replaces what it served before it restarted with its new listener', async () => {
    const before = 'http://127.0.0.1:39000';
    const { settings, tailnet, open } = setup({
      serving: { kind: 'proxy', target: before },
    });
    settings.save({ ...tailnetOnly, tailnetServeTarget: before });
    await open();

    expect(await servingOf(tailnet)).toEqual({
      kind: 'proxy',
      target: ownListener,
    });
    expect(settings.read().tailnetServeTarget).toBe(ownListener);
  });

  it('stops serving and forgets its target when the tailnet is turned off', async () => {
    const { settings, routes, listeners, tailnet, open } = setup();
    settings.save(tailnetOnly);
    await open();
    settings.save({ ...settings.read(), tailnet: false });
    await open();

    expect(await servingOf(tailnet)).toEqual({ kind: 'nothing' });
    expect(settings.read()).toEqual({
      lan: false,
      tailnet: false,
      cloudflare: false,
    });
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

  it('forgets its target without stopping what someone else now serves when the tailnet is turned off', async () => {
    const { settings, open } = setup({
      report: nodeReport({
        serving: { kind: 'proxy', target: 'http://127.0.0.1:3000' },
      }),
      outcome: { kind: 'failed' },
    });
    settings.save({
      ...tailnetOnly,
      tailnet: false,
      tailnetServeTarget: ownListener,
    });
    await open();

    expect(settings.read().tailnetServeTarget).toBeUndefined();
  });

  it.each([
    [
      'cannot be asked',
      { kind: 'unavailable' } as const,
      { kind: 'done' } as const,
    ],
    [
      'fails to stop',
      nodeReport({ serving: { kind: 'proxy', target: ownListener } }),
      { kind: 'failed' } as const,
    ],
  ])(
    'keeps its target to stop later when Tailscale %s as the tailnet is turned off',
    async (_, report, outcome) => {
      const { settings, open } = setup({ report, outcome });
      settings.save({
        ...tailnetOnly,
        tailnet: false,
        tailnetServeTarget: ownListener,
      });
      await open();

      expect(settings.read().tailnetServeTarget).toBe(ownListener);
    },
  );

  it('closes every route and stops serving the tailnet when the server stops, keeping what the owner turned on', async () => {
    const { settings, routes, listeners, tailnet, open, close } = setup();
    settings.save({ ...lanAtHome, tailnet: true });
    await open();
    await close();

    expect(listeners.bound({ route: 'lan' })).toEqual([]);
    expect(listeners.bound({ route: 'tailnet' })).toEqual([]);
    expect(await servingOf(tailnet)).toEqual({ kind: 'nothing' });
    expect(settings.read()).toEqual({ ...lanAtHome, tailnet: true });
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
