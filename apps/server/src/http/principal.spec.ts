import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openApplication } from '../app.ts';
import type { Principal } from '../models/principal.ts';
import { UnauthorizedError } from './errors/unauthorized-error.ts';
import { pairDevice, pairingReach } from './helpers/paired-server.ts';
import { callerOf } from './principal.ts';
import { createNetworkServer } from './server.ts';

it('puts a principal on every request, including the public ones', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-principal-'));
  const application = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    pairingReach,
  });
  const server = createNetworkServer({ application });
  const seen: Record<string, Principal | undefined> = {};
  server.addHook('onResponse', (request, _reply, done) => {
    seen[request.url] = request.principal;
    done();
  });
  try {
    // Public routes run no authentication hook at all.
    expect((await server.inject({ url: '/api/health' })).statusCode).toBe(200);
    expect(
      (
        await server.inject({
          method: 'DELETE',
          url: '/api/session',
          headers: { 'x-porcelain-browser': '1' },
        })
      ).statusCode,
    ).toBe(204);
    expect(seen['/api/health']).toEqual({ kind: 'anonymous' });
    expect(seen['/api/session']).toEqual({ kind: 'anonymous' });

    // A rejected credential leaves the caller anonymous rather than a viewer.
    expect(
      (
        await server.inject({
          url: '/api/inventory',
          headers: { authorization: 'Bearer wrong' },
        })
      ).statusCode,
    ).toBe(401);
    expect(seen['/api/inventory']).toEqual({ kind: 'anonymous' });

    // A paired device is a viewer, and the principal names which device it is.
    const headers = await pairDevice(server, application);
    expect(
      (await server.inject({ url: '/api/inventory', headers })).statusCode,
    ).toBe(200);
    expect(seen['/api/inventory']).toMatchObject({ kind: 'viewer' });
    expect(
      seen['/api/inventory']?.kind === 'viewer' &&
        seen['/api/inventory'].deviceId,
    ).toEqual(expect.any(String));
  } finally {
    await server.close();
    await application.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('refuses to hand an anonymous caller to the application', () => {
  const anonymous = { principal: { kind: 'anonymous' } as Principal };
  expect(() =>
    callerOf(anonymous as unknown as Parameters<typeof callerOf>[0]),
  ).toThrow(UnauthorizedError);
  const viewer = {
    principal: { kind: 'viewer', deviceId: null } as Principal,
  };
  expect(callerOf(viewer as unknown as Parameters<typeof callerOf>[0])).toEqual(
    { kind: 'viewer', deviceId: null },
  );
});
