import { requestBoundary } from '../../server-factory.ts';
import { Effect, Layer } from 'effect';
import { Observability } from '../../../runtime/observability.ts';

const observability = Effect.runSync(
  Observability.pipe(Effect.provide(Observability.layer)),
);
import { expect, it } from 'vitest';
import { openHttpApplication } from '@porcelain/server/kit/http';
import { HttpRouter } from 'effect/http';
import { deliverBrowserCredential } from '../../hooks/browser-credential.ts';
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
  const application = owner
    ? routes.owner
    : Layer.merge(
        routes.public,
        routes.pairing.pipe(
          Layer.provide(
            HttpRouter.middleware((app) =>
              app.pipe(
                Effect.flatMap((response) =>
                  deliverBrowserCredential(
                    { cookieMaxAgeSeconds: 600 },
                    response,
                  ),
                ),
              ),
            ).combine(
              requestBoundary({
                principal: undefined,
                logger: { failure: () => undefined },
                observability,
                bodyBytes: 1024,
              }),
            ).layer,
          ),
        ),
      );
  const server = await openHttpApplication(
    application,
    owner ? { kind: 'owner' } : undefined,
  );
  return { server, calls, close: server.close };
}

it('serves public health without a caller and preserves explicit null for the absent version', async () => {
  const test = await fixture();
  try {
    const health = await test.server.send({
      method: 'GET',
      path: '/api/health',
    });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok', environmentId });
    const environment = await test.server.send({
      method: 'GET',
      path: '/api/environment',
    });
    expect(await environment.json()).toEqual({
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
    const response = await test.server.send({
      method: 'POST',
      path: '/api/pair',
      headers: { 'x-porcelain-browser': '1' },
      body: { code: 'pcp_test', platform: 'iPadOS' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      device: {
        id: deviceId,
        label: 'iPad',
        platform: 'iPadOS',
        createdAt: '2026-10-05T03:00:00.000Z',
      },
    });
    expect(response.headers.get('set-cookie')).toContain('pcd_test_secret');
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
    const nulled = await test.server.send({
      method: 'POST',
      path: '/api/pair',
      body: { code: 'pcp_test', platform: 'iPadOS', label: null },
    });
    expect(nulled.status).toBe(400);
    const malformed = await test.server.send({
      method: 'POST',
      path: '/api/pair',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(test.calls).toEqual([]);
  } finally {
    await test.close();
  }
});

it('keeps the owner protocol at its original paths without adding an api prefix', async () => {
  const test = await fixture(true);
  try {
    const status = await test.server.send({ method: 'GET', path: '/status' });
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({
      address: 'http://127.0.0.1:4173',
      dataDirectory: '/disposable',
      pid: 1234,
    });
    const access = await test.server.send({ method: 'GET', path: '/access' });
    expect(access.status).toBe(200);
    expect(await access.json()).toEqual({ grants: [], devices: [] });
    const extra = await test.server.send({
      method: 'GET',
      path: '/api/status',
    });
    expect(extra.status).toBe(404);
  } finally {
    await test.close();
  }
});
