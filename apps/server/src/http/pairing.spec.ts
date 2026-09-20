import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openApplication } from '../app.ts';
import type { Application } from '../application.ts';
import { authenticate } from './middlewares/authenticate.ts';
import { createNetworkServer } from './server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };
/** Injected fixtures never listen, so the origin is stated rather than bound. */
const pairingOrigin = 'http://127.0.0.1:3000';

type Fixture = {
  root: string;
  application: Application;
  server: ReturnType<typeof createNetworkServer>;
  close(): Promise<void>;
};

async function fixture(prefix: string): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const application = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    pairingReach: () => ({
      port: 3000,
      // Loopback is only reachable when it is bound, so say so.
      policy: { allowedHosts: [], localAddresses: ['127.0.0.1'] },
    }),
  });
  const server = createNetworkServer({ application, token });
  return {
    root,
    application,
    server,
    close: async () => {
      await server.close();
      await application.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

/** Issue a link through the application, as the owner socket would. */
async function link(application: Application) {
  const [issued] = await application.issuePairing(['iPhone'], [pairingOrigin]);
  if (!issued) throw new Error('Expected a grant');
  return issued;
}

async function redeem(
  server: Fixture['server'],
  code: string,
  extra: Record<string, string> = {},
) {
  return server.inject({
    method: 'POST',
    url: '/api/pair',
    headers: { 'content-type': 'application/json', ...extra },
    payload: { code, platform: 'iOS 18', label: 'iPhone' },
  });
}

it('pairs once, works immediately, and refuses the link afterwards', async () => {
  const context = await fixture('porcelain-pair-http-');
  try {
    const issued = await link(context.application);
    // The code rides in the fragment, which is why it never reaches a log.
    expect(issued.link).toContain('/pair#c=');
    expect(issued.link).toContain(issued.code);

    const first = await redeem(context.server, issued.code);
    expect(first.statusCode).toBe(200);
    const credential = first.json().credential as string;
    expect(credential).toMatch(/^pcd_/);

    const authorised = await context.server.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${credential}` },
    });
    expect(authorised.statusCode).toBe(200);

    const second = await redeem(context.server, issued.code);
    expect(second.statusCode).toBe(401);
    expect(second.json()).toMatchObject({ code: 'INVALID_PAIRING' });
  } finally {
    await context.close();
  }
});

it('gives a browser a cookie and never the credential itself', async () => {
  const context = await fixture('porcelain-pair-cookie-');
  try {
    const issued = await link(context.application);
    const response = await redeem(context.server, issued.code, {
      'x-porcelain-browser': '1',
    });
    expect(response.statusCode).toBe(200);
    // Handing the same secret to script would make HttpOnly decorative.
    expect(response.json().credential).toBeUndefined();
    const cookie = response.headers['set-cookie'] as string;
    expect(cookie).toContain('porcelain_device=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api');

    const value = /porcelain_device=([^;]+)/.exec(cookie)?.[1] ?? '';
    const authorised = await context.server.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { cookie: `porcelain_device=${value}` },
    });
    expect(authorised.statusCode).toBe(200);
  } finally {
    await context.close();
  }
});

it('never lets a device credential become the agent principal', async () => {
  const context = await fixture('porcelain-pair-agent-');
  const seen: string[] = [];
  // Registered before the first request, because Fastify seals its hooks once
  // the instance has served anything.
  context.server.addHook('onResponse', (request, _reply, done) => {
    seen.push(`${request.url} ${JSON.stringify(request.principal)}`);
    done();
  });
  try {
    const issued = await link(context.application);
    const credential = (await redeem(context.server, issued.code)).json()
      .credential as string;

    // The MCP door grants `agent` to the shared token. A device credential
    // replayed there must be its own device, never an agent: otherwise a
    // stolen browser cookie would be attributed as one.
    const listing = await context.server.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: {
        authorization: `Bearer ${credential}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'inventory', arguments: {} },
      },
    });
    expect(listing.statusCode).not.toBe(500);
    // The device reached the agent door and was still its own device.
    const atMcp = seen.filter((entry) => entry.startsWith('/api/mcp')).at(-1);
    expect(atMcp).toContain('"kind":"viewer"');
    expect(atMcp).not.toContain('agent');

    await context.server.inject({
      method: 'GET',
      url: '/api/inventory',
      headers: { authorization: `Bearer ${credential}` },
    });
    expect(seen.at(-1)).toContain('"kind":"viewer"');
    expect(seen.at(-1)).toContain(`"deviceId":"`);

    // The shared token at the same door is still an agent, so the distinction
    // is the credential's, not the route's.
    await context.server.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    expect(seen.at(-1)).toContain('"kind":"agent"');
  } finally {
    await context.close();
  }
});

it('refuses a device whose label or platform could forge the owner listing', async () => {
  const context = await fixture('porcelain-pair-control-');
  try {
    const issued = await link(context.application);
    const response = await context.server.inject({
      method: 'POST',
      url: '/api/pair',
      headers: { 'content-type': 'application/json' },
      // An escape sequence here is printed by `porcelain devices`.
      payload: {
        code: issued.code,
        platform: 'iOS\u001b[2K\u001b[1GiPad',
        label: 'iPhone',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_DEVICE_DETAILS' });
    // The grant survives, so a rejected attempt does not burn the owner's link.
    expect((await redeem(context.server, issued.code)).statusCode).toBe(200);
  } finally {
    await context.close();
  }
});

it('limits unauthenticated redemption attempts', async () => {
  const context = await fixture('porcelain-pair-limit-');
  try {
    const codes = Array.from({ length: 14 }, () => 'pcp_not-a-real-code');
    const statuses: number[] = [];
    for (const code of codes)
      statuses.push((await redeem(context.server, code)).statusCode);
    // Entropy makes guessing hopeless; the limit is about a flood forcing
    // hashes and SQLite reads on the shared event loop.
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(
      0,
    );
  } finally {
    await context.close();
  }
});

it('cuts a response the device is still holding when it is revoked', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pair-revoke-'));
  // Filled in once the listener reports the port it bound, exactly as the
  // runtime does.
  const reach = {
    port: 0,
    policy: { allowedHosts: [], localAddresses: ['127.0.0.1'] },
  };
  const application = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    pairingReach: () => reach,
  });
  const server = createNetworkServer({ application, token });
  const reached = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  // A route behind the real authentication hook that then stops, so the
  // response is provably still open when the revocation lands. Registering it
  // without the hook would skip the live-connection registry entirely and this
  // test would pass with the feature deleted.
  server.register(
    async (held) => {
      held.addHook('onRequest', authenticate({ token, application }));
      held.get('/held', async (_request, reply) => {
        reached.resolve();
        await release.promise;
        return reply.send({ done: true });
      });
    },
    { prefix: '/api' },
  );
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    reach.port = Number(new URL(address).port);
    const [issued] = await application.issuePairing(
      ['iPhone'],
      [`http://127.0.0.1:${reach.port}`],
    );
    if (!issued) throw new Error('Expected a grant');
    const redeemed = await fetch(`${address}/api/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: issued.code, platform: 'iOS 18' }),
    });
    const { device, credential } = (await redeemed.json()) as {
      device: { id: string };
      credential: string;
    };

    let outcome: unknown;
    const settled = fetch(`${address}/api/held`, {
      headers: { authorization: `Bearer ${credential}` },
    }).then(
      async (response) => {
        outcome = `answered ${response.status}`;
        await response.text();
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    // The handler is running and the connection is registered.
    await reached.promise;
    expect(outcome).toBeUndefined();

    await application.revokeAccess(device.id);
    await settled;
    // Destroyed rather than completed, and before the handler was released.
    expect(outcome).toBeInstanceOf(Error);
    release.resolve();

    const after = await fetch(`${address}/api/inventory`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    expect(after.status).toBe(401);
    await after.text();
    expect((await application.listAccess()).devices).toEqual([]);
  } finally {
    release.resolve();
    await server.close();
    await application.close();
    await rm(root, { recursive: true, force: true });
  }
}, 20000);

it('revokes a pending link before anyone redeems it', async () => {
  const context = await fixture('porcelain-pair-revoke-grant-');
  try {
    const issued = await link(context.application);
    const listing = await context.application.listAccess();
    expect(listing.grants.map((grant) => grant.id)).toEqual([issued.grant.id]);

    // The owner pasted it into the wrong window and wants it dead.
    expect(await context.application.revokeAccess(issued.grant.id)).toEqual({
      revoked: true,
      kind: 'grant',
    });
    const refused = await redeem(context.server, issued.code);
    expect(refused.statusCode).toBe(401);
    expect((await context.application.listAccess()).grants).toEqual([]);
  } finally {
    await context.close();
  }
});

it('keeps a constantly used browser signed in past ninety days', async () => {
  const context = await fixture('porcelain-pair-refresh-');
  try {
    const issued = await link(context.application);
    const first = await redeem(context.server, issued.code, {
      'x-porcelain-browser': '1',
    });
    let cookie =
      /porcelain_device=([^;]+)/.exec(
        first.headers['set-cookie'] as string,
      )?.[1] ?? '';

    // Hourly use for just over ninety days. Refreshing only after an idle gap
    // would never fire here, and the original Max-Age would lapse on day 90.
    const hours = 91 * 24;
    let refreshes = 0;
    for (let hour = 0; hour < hours; hour++) {
      const response = await context.server.inject({
        method: 'GET',
        url: '/api/inventory',
        headers: { cookie: `porcelain_device=${cookie}` },
      });
      expect(response.statusCode, `hour ${hour}`).toBe(200);
      const header = response.headers['set-cookie'] as string | undefined;
      if (header?.includes('porcelain_device=')) {
        refreshes += 1;
        cookie = /porcelain_device=([^;]+)/.exec(header)?.[1] ?? cookie;
        expect(header).toContain('Max-Age=7776000');
      }
    }
    // Every request renewed the window, so the browser is never logged out by
    // age while it is in use.
    expect(refreshes).toBe(hours);
  } finally {
    await context.close();
  }
}, 30000);

it('takes the device credential away when the browser disconnects', async () => {
  const context = await fixture('porcelain-pair-logout-');
  try {
    const issued = await link(context.application);
    const response = await redeem(context.server, issued.code, {
      'x-porcelain-browser': '1',
    });
    const cookie =
      /porcelain_device=([^;]+)/.exec(
        response.headers['set-cookie'] as string,
      )?.[1] ?? '';
    expect(cookie).not.toBe('');

    const out = await context.server.inject({
      method: 'DELETE',
      url: '/api/session',
      headers: {
        'x-porcelain-browser': '1',
        cookie: `porcelain_device=${cookie}`,
      },
    });
    expect(out.statusCode).toBe(204);
    // Both credentials are expired, as separate Set-Cookie values. Clearing
    // only the session would leave the browser authenticating again from the
    // device cookie on its very next request.
    const expired = out.headers['set-cookie'] as string[];
    expect(expired).toHaveLength(2);
    expect(expired.join(' ')).toContain('porcelain_session=;');
    expect(expired.join(' ')).toContain('porcelain_device=;');
    for (const value of expired) expect(value).toContain('Max-Age=0');
  } finally {
    await context.close();
  }
});

it('limits redemption across peers, not only per peer', async () => {
  const context = await fixture('porcelain-pair-limit-global-');
  try {
    const statuses: number[] = [];
    // A rotating source address buys nothing: the shared ceiling is spent
    // first, so an attacker with many addresses cannot multiply the work.
    for (let attempt = 0; attempt < 90; attempt++)
      statuses.push(
        (
          await context.server.inject({
            method: 'POST',
            url: '/api/pair',
            headers: { 'content-type': 'application/json' },
            remoteAddress: `10.0.${Math.floor(attempt / 250)}.${attempt % 250}`,
            payload: { code: 'pcp_not-a-real-code', platform: 'iOS' },
          })
        ).statusCode,
      );
    expect(statuses).toContain(429);
  } finally {
    await context.close();
  }
});

it('keeps the shared token working so the web and its tests still pass', async () => {
  const context = await fixture('porcelain-pair-legacy-');
  try {
    expect(
      (
        await context.server.inject({
          method: 'GET',
          url: '/api/inventory',
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await context.server.inject({ method: 'GET', url: '/api/inventory' }))
        .statusCode,
    ).toBe(401);
  } finally {
    await context.close();
  }
});
