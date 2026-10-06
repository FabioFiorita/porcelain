import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { ownerClient, runOwner } from './owner-client.ts';

const owned: { directory: string; server: Server }[] = [];
afterEach(async () => {
  for (const { directory, server } of owned.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture(
  answer: (path: string, body: unknown) => { status: number; body: unknown },
) {
  const directory = await mkdtemp(join(tmpdir(), 'pc-owner-'));
  const calls: {
    method: string | undefined;
    path: string | undefined;
    body: unknown;
  }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const body: unknown = text ? JSON.parse(text) : undefined;
      calls.push({ method: request.method, path: request.url, body });
      const result = answer(request.url ?? '', body);
      response.writeHead(result.status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result.body));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(ownerSocketPath(directory), resolve);
  });
  owned.push({ directory, server });
  return { api: ownerClient(directory, 1000), calls, directory };
}

it('uses the native owner paths and validates JSON in both directions over the actual socket', async () => {
  const test = await fixture((path) => ({
    status: 200,
    body:
      path === '/access'
        ? { grants: [], devices: [] }
        : { id: 'device-1', trusted: true },
  }));
  await expect(runOwner(test.api.administration.listAccess())).resolves.toEqual(
    { grants: [], devices: [] },
  );
  await expect(
    runOwner(
      test.api.administration.setDeviceTrust({
        payload: { id: 'device-1', trusted: true },
      }),
    ),
  ).resolves.toEqual({ id: 'device-1', trusted: true });
  expect(test.calls).toEqual([
    { method: 'GET', path: '/access', body: undefined },
    {
      method: 'POST',
      path: '/access/trust',
      body: { id: 'device-1', trusted: true },
    },
  ]);
});

it('reports an absent owner socket and a malformed successful answer', async () => {
  const test = await fixture(() => ({ status: 200, body: { invalid: true } }));
  await expect(
    runOwner(test.api.administration.listAccess()),
  ).rejects.toMatchObject({
    name: 'OwnerRequestError',
    message: 'The server answered unrecognizably.',
  });
  const absent = join(test.directory, 'missing');
  await expect(
    runOwner(ownerClient(absent, 1000).administration.listAccess()),
  ).rejects.toMatchObject({
    name: 'OwnerRequestError',
    message: `Porcelain is not running for ${absent}.`,
  });
});
