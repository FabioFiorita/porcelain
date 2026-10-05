import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { createServer } from '../../server-factory.ts';
import { deliverBrowserCredential } from '../../hooks/browser-credential.ts';
import { mountEffectRoutes } from '../../effect-bridge.ts';
import { accessRoutes } from './access-api.ts';

const environmentId = 'e0000000-0000-4000-8000-000000000001';
const deviceId = 'd0000000-0000-4000-8000-000000000001';

async function fixture(owner = false) {
  const calls: unknown[] = [];
  const unused = {
    execute: () => Effect.die(new Error('Unexpected operation')),
  };
  const routes = accessRoutes({
    clearBrowserSession: { execute: () => Effect.succeed(undefined) },
    issueLiveTicket: unused,
    issuePairing: unused,
    listAccess: { execute: () => Effect.succeed({ grants: [], devices: [] }) },
    readEnvironment: {
      execute: () =>
        Effect.succeed({
          environmentId,
          name: 'Workstation',
          version: undefined,
          protocol: 1,
        }),
    },
    readHealth: {
      execute: () => Effect.succeed({ status: 'ok', environmentId }),
    },
    readOwnerStatus: {
      execute: () =>
        Effect.succeed({
          address: 'http://127.0.0.1:4173',
          dataDirectory: '/disposable',
          pid: 1234,
        }),
    },
    readRemoteAccess: unused,
    readServiceUpdate: unused,
    readSession: unused,
    redeemPairing: {
      execute: (input) =>
        Effect.sync(() => {
          calls.push(input);
          return {
            device: {
              id: deviceId,
              label: 'iPad',
              platform: 'iPadOS',
              createdAt: '2026-10-05T03:00:00.000Z',
            },
            credential: 'pcd_test_secret',
          };
        }),
    },
    renameEnvironment: unused,
    revokeAccess: unused,
    setDeviceTrust: unused,
    setRemoteAccess: unused,
    startServiceUpdate: unused,
  });
  const server = createServer({
    principal: owner ? { kind: 'owner' } : undefined,
    logger: { failure: () => undefined },
  });
  if (owner) await server.register(mountEffectRoutes, { routes: routes.owner });
  else {
    await server.register(mountEffectRoutes, {
      prefix: '/api',
      routes: routes.public,
    });
    await server.register(
      async (pairing) => {
        pairing.addHook(
          'preSerialization',
          deliverBrowserCredential({ cookieMaxAgeSeconds: 600 }),
        );
        pairing.register(mountEffectRoutes, { routes: routes.pairing });
      },
      { prefix: '/api' },
    );
  }
  return {
    server,
    calls,
    close: async () => {
      await server.close();
      for (const scope of Object.values(routes)) await scope.dispose();
    },
  };
}

it('serves public health without a caller and preserves explicit null for the absent version', async () => {
  const test = await fixture();
  try {
    const health = await test.server.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(health.statusCode, health.body).toBe(200);
    expect(health.json()).toEqual({ status: 'ok', environmentId });
    const environment = await test.server.inject({
      method: 'GET',
      url: '/api/environment',
    });
    expect(environment.json()).toEqual({
      environmentId,
      name: 'Workstation',
      version: null,
      protocol: 1,
    });
  } finally {
    await test.close();
  }
});

it('delivers a browser pairing credential as a cookie and removes it from the JSON body', async () => {
  const test = await fixture();
  try {
    const response = await test.server.inject({
      method: 'POST',
      url: '/api/pair',
      headers: { 'x-porcelain-browser': '1' },
      payload: { code: 'pcp_test', platform: 'iPadOS' },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      device: {
        id: deviceId,
        label: 'iPad',
        platform: 'iPadOS',
        createdAt: '2026-10-05T03:00:00.000Z',
      },
    });
    expect(response.headers['set-cookie']).toContain('pcd_test_secret');
    expect(test.calls).toEqual([
      { code: 'pcp_test', platform: 'iPadOS', route: 'lan' },
    ]);
  } finally {
    await test.close();
  }
});

it('rejects null optional input and malformed JSON before issuing a credential', async () => {
  const test = await fixture();
  try {
    const nulled = await test.server.inject({
      method: 'POST',
      url: '/api/pair',
      payload: { code: 'pcp_test', platform: 'iPadOS', label: null },
    });
    expect(nulled.statusCode, nulled.body).toBe(400);
    const malformed = await test.server.inject({
      method: 'POST',
      url: '/api/pair',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(malformed.statusCode, malformed.body).toBe(400);
    expect(test.calls).toEqual([]);
  } finally {
    await test.close();
  }
});

it('keeps the owner protocol at its original paths without adding an api prefix', async () => {
  const test = await fixture(true);
  try {
    const status = await test.server.inject({ method: 'GET', url: '/status' });
    expect(status.statusCode, status.body).toBe(200);
    expect(status.json()).toEqual({
      address: 'http://127.0.0.1:4173',
      dataDirectory: '/disposable',
      pid: 1234,
    });
    const access = await test.server.inject({ method: 'GET', url: '/access' });
    expect(access.statusCode, access.body).toBe(200);
    expect(access.json()).toEqual({ grants: [], devices: [] });
    const extra = await test.server.inject({
      method: 'GET',
      url: '/api/status',
    });
    expect(extra.statusCode).toBe(404);
  } finally {
    await test.close();
  }
});
