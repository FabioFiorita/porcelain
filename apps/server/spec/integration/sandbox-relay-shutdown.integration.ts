import { once } from 'node:events';
import { connect } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, inject } from 'vitest';
import { IsolatedServer, Recorder } from '../kit/isolated-server.ts';
import { test } from '../kit/server-test.ts';

const root = resolve(import.meta.dirname, '../../../..');

test.skipIf(process.platform !== 'linux')(
  'stops the sandbox after a peer reuses a relay connection whose upstream has closed',
  async ({ onTestFinished }) => {
    const server = await IsolatedServer.start(root, inject('serverBuild'));
    const address = new URL(server.address);
    const peer = connect({
      host: address.hostname,
      port: Number(address.port),
      allowHalfOpen: true,
    });
    onTestFinished(async () => {
      peer.destroy();
      await server.stop().catch(() => undefined);
    });
    const response: Buffer[] = [];
    peer.on('data', (chunk: Buffer) => response.push(chunk));
    const ended = once(peer, 'end');
    peer.write(
      `GET /health HTTP/1.1\r\nHost: ${address.host}\r\nConnection: close\r\n\r\n`,
    );
    await ended;
    expect(Buffer.concat(response).toString()).toContain('HTTP/1.1 200 OK');
    const health = await server.read(new Recorder(), {
      method: 'GET',
      path: '/health',
    });
    expect(health.status).toBe(200);
    peer.write(`GET /health HTTP/1.1\r\nHost: ${address.host}\r\n\r\n`);
    const afterReuse = await server.read(new Recorder(), {
      method: 'GET',
      path: '/health',
    });
    expect(afterReuse.status).toBe(200);
    await expect(server.stop()).resolves.toBeUndefined();
    await expect(server.stop()).resolves.toBeUndefined();
    expect(existsSync(server.projectHome)).toBe(false);
  },
);
