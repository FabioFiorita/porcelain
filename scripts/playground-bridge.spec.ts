import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { playgroundBridge } from '../apps/web/development/playground-bridge.ts';

test('only explicit same-origin requests can inspect the configured playground token', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-bridge-'));
  const tokenFile = join(root, 'token.txt');
  await writeFile(tokenFile, 'disposable-test-token\n', { mode: 0o600 });
  const middleware = playgroundBridge(tokenFile);
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
    const response = await fetch(`${origin}/__porcelain/playground`, {
      method: 'POST',
      headers,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      tokenFile,
      token: 'disposable-test-token',
    });
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
    await rm(tokenFile);
    const missing = await fetch(`${origin}/__porcelain/playground`, {
      method: 'POST',
      headers,
    });
    expect(missing.status).toBe(503);
    expect(await missing.text()).toBe('');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
});
