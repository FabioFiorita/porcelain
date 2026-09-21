import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { pairBrowser, pairingReach } from '../helpers/paired-server.ts';
import { createServer } from '../server.ts';

function opened(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
}

function nextMessage(socket: WebSocket) {
  return new Promise<unknown>((resolve, reject) => {
    socket.once('message', (bytes) => resolve(JSON.parse(bytes.toString())));
    socket.once('error', reject);
  });
}

function refused(socket: WebSocket) {
  return new Promise<number>((resolve, reject) => {
    socket.once('unexpected-response', (_request, response) =>
      resolve(response.statusCode ?? 0),
    );
    socket.once('open', () =>
      reject(new Error('WebSocket unexpectedly opened')),
    );
    socket.once('error', () => undefined);
  });
}

it('authenticates same-origin sockets and cuts the upgraded connection on revocation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-live-http-'));
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: root,
  });
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const target = `${address.replace(/^http/, 'ws')}/api/live`;

    expect(await refused(new WebSocket(target, { origin: address }))).toBe(401);

    const paired = await pairBrowser(
      server,
      server.application,
      'Live browser',
    );
    expect(
      await refused(
        new WebSocket(target, {
          headers: { cookie: paired.cookie },
          origin: 'https://foreign.example',
        }),
      ),
    ).toBe(403);

    const socket = new WebSocket(target, {
      headers: { cookie: paired.cookie },
      origin: address,
    });
    const ready = nextMessage(socket);
    await opened(socket);
    expect(await ready).toEqual({ type: 'ready' });
    const device = (await server.application.listAccess()).devices.find(
      (entry) => entry.label === 'Live browser',
    );
    if (!device) throw new Error('Missing paired device');
    const closed = new Promise<number>((resolve) =>
      socket.once('close', (code) => resolve(code)),
    );
    expect((await server.application.revokeAccess(device.id)).revoked).toBe(
      true,
    );
    expect(await closed).toBe(4001);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('closes upgraded sockets before the application-owned server finishes shutdown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-live-close-'));
  const server = await createServer({
    pairingReach,
    dataDirectory: join(root, 'state'),
    projectHome: root,
  });
  try {
    const address = await server.listen({ host: '127.0.0.1', port: 0 });
    const { cookie } = await pairBrowser(
      server,
      server.application,
      'Closing browser',
    );
    const socket = new WebSocket(`${address.replace(/^http/, 'ws')}/api/live`, {
      headers: { cookie },
      origin: address,
    });
    await opened(socket);
    const closed = new Promise<void>((resolve) =>
      socket.once('close', () => resolve()),
    );
    await server.close();
    await closed;
    expect(socket.readyState).toBe(WebSocket.CLOSED);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
