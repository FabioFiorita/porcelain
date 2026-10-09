import { NodeServices } from '@effect/platform-node';
import type { ReadRemoteAccessResponse } from '@porcelain/contracts/access';
import { Effect, Layer, ManagedRuntime, Scope } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, vi } from 'vitest';
import { composeServer } from '../../src/bootstrap/compose-server.ts';
import { ownerClient, ownerRequest } from '../../src/cli/owner-client.ts';
import { readServerSettings } from '../../src/config/server-settings.ts';
import type { Runtime } from '../../src/ports/runtime.ts';
import { FixedNetworkAddressReader } from '../fakes/fixed-network-address-reader.ts';
import { InMemoryRouteListenerRunner } from '../fakes/in-memory-route-listener-runner.ts';
import { ScriptedServiceUpdateRunner } from '../fakes/scripted-service-update-runner.ts';
import { ScriptedTunnelProbe } from '../fakes/scripted-tunnel-probe.ts';
import { scratchFolder } from '../kit/sandbox.ts';
import { test } from '../kit/server-test.ts';

const LAN_ADDRESS = '192.168.1.20';

function lanNetwork() {
  return new FixedNetworkAddressReader(
    [
      {
        interfaceName: 'eth0',
        address: LAN_ADDRESS,
        family: 'IPv4',
        internal: false,
        physical: true,
        netmask: '255.255.255.0',
        cidr: `${LAN_ADDRESS}/24`,
      },
    ],
    [
      {
        interfaceName: 'eth0',
        metric: 100,
        gateway: '192.168.1.1',
        gatewayHardware: '02:00:5e:10:00:01',
      },
    ],
  ).layer;
}

const host = {
  version: undefined,
  desktopSession: {
    deviceId: randomUUID(),
    secretHash: createHash('sha256').update(randomUUID()).digest('hex'),
  },
  serviceUpdateRunner: new ScriptedServiceUpdateRunner(
    {
      managed: false,
      version: undefined,
      latest: undefined,
      available: false,
      running: false,
      last: undefined,
    },
    [],
    0,
  ),
};

function owner<A, E>(
  state: string,
  request: (
    client: Effect.Success<ReturnType<typeof ownerClient>>['administration'],
  ) => Effect.Effect<A, E>,
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* ownerClient(state, 5_000);
      return yield* ownerRequest(request(client.administration));
    }),
  );
}

function settledLan(state: string) {
  return vi.waitFor(
    async () => {
      const access: ReadRemoteAccessResponse = await owner(state, (client) =>
        client.readRemoteAccess(),
      );
      if (access.routes.lan.status.kind === 'starting')
        throw new Error('Local network sharing never settled');
      return access.routes.lan;
    },
    { timeout: 10_000, interval: 100 },
  );
}

test('local network sharing turned on stays on at the same address after the server restarts on the same data directory', async () => {
  const root = realpathSync(
    await mkdtemp(join(scratchFolder(), 'porcelain-sharing-')),
  );
  const state = join(root, 'state');
  const runtime = ManagedRuntime.make(
    Layer.merge(NodeServices.layer, Layer.effect(Scope.Scope, Effect.scope)),
  );
  let port = 0;
  let application: Runtime | undefined;
  const start = async () => {
    const startServer = composeServer({
      networkAddressReader: lanNetwork,
      routeListenerRunner: () =>
        InMemoryRouteListenerRunner.layer(
          new InMemoryRouteListenerRunner(
            () => port,
            () => 41000,
          ),
        ),
      tunnelProbe: () =>
        new ScriptedTunnelProbe(() =>
          Effect.succeed({ kind: 'unreachable' as const }),
        ).layer,
    });
    application = await runtime.runPromise(
      startServer(
        readServerSettings({ dataDirectory: state, projectHome: root, port }),
        host,
      ),
    );
    port = Number(new URL(application.address).port);
  };
  try {
    await start();
    await owner(state, (client) =>
      client.setRemoteAccess({ payload: { lan: true } }),
    );
    const shared = await settledLan(state);

    await runtime.runPromise(application?.close() ?? Effect.void);
    application = undefined;
    await start();
    const restarted = await settledLan(state);

    expect(shared).toStrictEqual({
      enabled: true,
      status: { kind: 'on', urls: [`http://${LAN_ADDRESS}:${port}`] },
    });
    expect(restarted).toStrictEqual(shared);
  } finally {
    if (application) await runtime.runPromise(application.close());
    await runtime.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
