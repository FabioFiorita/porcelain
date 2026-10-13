import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { developmentPairing } from './development-pairing.ts';

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

let helper: Awaited<ReturnType<typeof startHelper>>;
beforeEach(async () => {
  helper = await startHelper();
});
afterEach(async () => {
  await helper.stop();
});

async function startHelper() {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-dev-pair-'));
  const socket = join(directory, 'owner.sock');
  const requests: {
    method: string | undefined;
    path: string | undefined;
    body: unknown;
  }[] = [];
  const response = { status: 200, malformed: false, empty: false };
  const owner = createServer((incoming, out) => {
    let body = '';
    incoming.setEncoding('utf8');
    incoming.on('data', (chunk: string) => {
      body += chunk;
    });
    incoming.on('end', () => {
      const parsed: unknown = JSON.parse(body);
      requests.push({
        method: incoming.method,
        path: incoming.url,
        body: parsed,
      });
      out.statusCode = response.status;
      const code = `grant-${requests.length}`;
      out.end(
        response.malformed
          ? 'malformed'
          : JSON.stringify({
              grants: response.empty
                ? []
                : [
                    {
                      grant: {
                        id: code,
                        label: 'Development mobile',
                        addresses: ['http://localhost:4300'],
                        createdAt: '2026-10-13',
                        expiresAt: '2026-10-13',
                        trusted: false,
                      },
                      code,
                      link: `http://localhost:4300/pair#c=${code}&e=development`,
                    },
                  ],
            }),
      );
    });
  });
  owner.listen(socket);
  await once(owner, 'listening');
  const input = {
    ownerSocket: socket,
    serverAddress: 'http://localhost:4300',
    label: 'Development mobile',
  };
  const link = developmentPairing({ ...input, response: 'link' });
  const redirect = developmentPairing({ ...input, response: 'redirect' });
  const server = createServer((incoming, out) => {
    const handler = incoming.headers['x-web'] ? redirect : link;
    handler(incoming, out, () => {
      out.statusCode = 404;
      out.end();
    });
  });
  server.listen(0, '0.0.0.0');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('No helper port');
  return {
    url: `http://127.0.0.1:${address.port}/__porcelain/dev/pair`,
    port: address.port,
    requests,
    response,
    stop: async () => {
      await close(server);
      await close(owner);
      await rm(directory, { recursive: true, force: true });
    },
  };
}

it('Each request issues a fresh link for the development server through its owner socket', async () => {
  const first = await fetch(helper.url, { method: 'POST' });
  const second = await fetch(helper.url, { method: 'POST' });
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  expect(await first.text()).toBe(
    'http://localhost:4300/pair#c=grant-1&e=development',
  );
  expect(await second.text()).toBe(
    'http://localhost:4300/pair#c=grant-2&e=development',
  );
  expect(helper.requests).toEqual([
    {
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Development mobile'],
        addresses: ['http://localhost:4300'],
      },
    },
    {
      method: 'POST',
      path: '/pairings',
      body: {
        labels: ['Development mobile'],
        addresses: ['http://localhost:4300'],
      },
    },
  ]);
});

it('The browser keeps a redirect to its own pairing page', async () => {
  const answer = await fetch(helper.url, {
    method: 'POST',
    headers: { 'x-web': '1' },
    redirect: 'manual',
  });
  expect(answer.status).toBe(303);
  expect(answer.headers.get('location')).toBe('/pair#c=grant-1&e=development');
});

it('Reading the helper cannot issue a grant', async () => {
  const answer = await fetch(helper.url);
  expect(answer.status).toBe(405);
  expect(answer.headers.get('allow')).toBe('POST');
  expect(helper.requests).toEqual([]);
});

it('Other Metro paths continue without issuing a grant', async () => {
  const answer = await fetch(new URL('/status', helper.url), {
    method: 'POST',
  });
  expect(answer.status).toBe(404);
  expect(helper.requests).toEqual([]);
});

it('A request from the local network cannot issue a grant', async () => {
  const address = Object.values(networkInterfaces())
    .flat()
    .find((value) => value?.family === 'IPv4' && !value.internal)?.address;
  if (!address)
    throw new Error('This proof requires a local network interface');
  const answer = await fetch(
    `http://${address}:${helper.port}/__porcelain/dev/pair`,
    { method: 'POST' },
  );
  expect(answer.status).toBe(403);
  expect(helper.requests).toEqual([]);
});

it('An owner failure is visible and a retry issues a new link', async () => {
  helper.response.status = 503;
  const failed = await fetch(helper.url, { method: 'POST' });
  expect(failed.status).toBe(502);
  expect(await failed.text()).toBe(
    'Could not create a development pairing link: the owner answered 503\n',
  );
  helper.response.status = 200;
  const retried = await fetch(helper.url, { method: 'POST' });
  expect(retried.status).toBe(200);
  expect(await retried.text()).toBe(
    'http://localhost:4300/pair#c=grant-2&e=development',
  );
});

it('A malformed owner response produces an error without crashing the helper', async () => {
  helper.response.malformed = true;
  const failed = await fetch(helper.url, { method: 'POST' });
  expect(failed.status).toBe(502);
  expect(await failed.text()).toContain(
    'Could not create a development pairing link:',
  );
  helper.response.malformed = false;
  const retried = await fetch(helper.url, { method: 'POST' });
  expect(await retried.text()).toBe(
    'http://localhost:4300/pair#c=grant-2&e=development',
  );
});

it('An owner response without a grant produces an error', async () => {
  helper.response.empty = true;
  const failed = await fetch(helper.url, { method: 'POST' });
  expect(failed.status).toBe(502);
  expect(await failed.text()).toBe(
    'Could not create a development pairing link: the owner issued no grant\n',
  );
});
