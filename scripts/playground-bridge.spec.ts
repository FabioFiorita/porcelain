import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { startRuntime } from '../apps/server/src/lifecycle/runtime.ts';
import { playgroundBridge } from '../apps/web/development/playground-bridge.ts';

test('mints a single-use pairing link per request, and only for explicit same-origin callers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-bridge-'));
  await mkdir(join(root, 'home'), { recursive: true });
  const runtime = await startRuntime({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    port: 0,
  });
  const middleware = playgroundBridge({
    socketPath: runtime.socketPath,
    address: runtime.address,
  });
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.writeHead(404).end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  const origin = `http://127.0.0.1:${address.port}`;
  const headers = { origin, 'x-porcelain-playground': '1' };
  try {
    const link = async () => {
      const response = await fetch(`${origin}/__porcelain/playground`, {
        method: 'POST',
        headers,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return (await response.json()) as { link: string };
    };
    const first = await link();
    const second = await link();
    // Two windows, two links: nothing reusable is handed out, so one context
    // can never authenticate as another.
    expect(first.link).not.toBe(second.link);
    expect(new URL(first.link).pathname).toBe('/pair');
    expect(new URL(first.link).origin).toBe(new URL(runtime.address).origin);

    // The link works, once.
    const code = new URLSearchParams(
      new URL(first.link).hash.replace(/^#/, ''),
    ).get('c');
    const redeem = () =>
      fetch(`${runtime.address}/api/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, platform: 'Fixture' }),
      });
    expect((await redeem()).status).toBe(200);
    expect((await redeem()).status).not.toBe(200);

    for (const options of [
      { method: 'GET', headers },
      { method: 'OPTIONS', headers },
      { method: 'POST', headers: { origin } },
      { method: 'POST', headers: { 'x-porcelain-playground': '1' } },
      {
        method: 'POST',
        headers: { ...headers, origin: 'http://localhost:9999' },
      },
      {
        method: 'POST',
        headers: {
          ...headers,
          origin: 'http://attacker.example',
          host: 'attacker.example',
        },
      },
      {
        method: 'POST',
        headers: { ...headers, 'sec-fetch-site': 'cross-site' },
      },
    ]) {
      const denied = await fetch(`${origin}/__porcelain/playground`, options);
      expect(denied.status).toBe(403);
      expect(await denied.text()).toBe('');
    }
    expect(
      (
        await fetch(`${origin}/__porcelain/playground?file=/etc/passwd`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(404);

    // With no server answering the socket there is nothing to mint, and the
    // bridge says so rather than inventing a credential.
    await runtime.close();
    const stopped = await fetch(`${origin}/__porcelain/playground`, {
      method: 'POST',
      headers,
    });
    expect(stopped.status).toBe(503);
    expect(await stopped.text()).toBe('');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await runtime.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

test('delegates minting to a host that knows which server is current', async () => {
  // The server lab restarts its runtime into a fresh data directory, so a
  // socket path baked into the dev server would point at a dead socket and an
  // address baked in would be the wrong one. It asks the host each time.
  const asked: string[] = [];
  const host = createServer((request, response) => {
    asked.push(`${request.method} ${request.url}`);
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({ link: `http://127.0.0.1:9/pair#c=pcp_${asked.length}` }),
    );
  });
  host.listen(0, '127.0.0.1');
  await once(host, 'listening');
  const hostAddress = host.address();
  if (!hostAddress || typeof hostAddress === 'string')
    throw new Error('Missing port');
  const middleware = playgroundBridge({
    mintUrl: `http://127.0.0.1:${hostAddress.port}/porcelain-pairing`,
  });
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.writeHead(404).end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${origin}/__porcelain/playground`, {
      method: 'POST',
      headers: { origin, 'x-porcelain-playground': '1' },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      link: 'http://127.0.0.1:9/pair#c=pcp_1',
    });
    expect(asked).toEqual(['POST /porcelain-pairing']);

    // A host that cannot mint is a 503 here too, never an invented link.
    await new Promise<void>((resolve) => host.close(() => resolve()));
    const stopped = await fetch(`${origin}/__porcelain/playground`, {
      method: 'POST',
      headers: { origin, 'x-porcelain-playground': '1' },
    });
    expect(stopped.status).toBe(503);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    host.close();
  }
}, 20000);
