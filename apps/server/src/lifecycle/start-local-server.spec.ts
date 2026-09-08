import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readStartupSettings } from '../config/startup-settings.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { startLocalServer } from './start-local-server.ts';

describe('Local server lifecycle', () => {
  const token = 'fixture-token-with-at-least-32-characters';

  it('bounds shutdown when a client never finishes its request body', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-drain-'));
    const server = await startLocalServer({
      dataDirectory: root,
      token,
      port: 0,
    });
    const socket = connect({
      host: '127.0.0.1',
      port: Number(new URL(server.address).port),
    });
    const disconnected = new Promise<void>((resolve) =>
      socket.once('close', () => resolve()),
    );
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.once('connect', resolve);
      });
      socket.write(
        `POST /projects HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer ${token}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`,
      );
      // A pipelined health request cannot complete until this body is consumed.
      // Give the server one round trip to accept the open connection before closing.
      await fetch(`${server.address}/health`);
      await server.close();
      await disconnected;
      const restarted = await startLocalServer({
        dataDirectory: root,
        token,
        port: 0,
      });
      await restarted.close();
    } finally {
      socket.destroy();
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15000);

  it('rejects invalid configuration before creating state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-start-'));
    try {
      const dataDirectory = join(root, 'state');
      for (const environment of [
        { PORCELAIN_PORT: undefined },
        { PORCELAIN_PORT: '' },
        { PORCELAIN_PORT: '1.5' },
        { PORCELAIN_PORT: '65536' },
        { PORCELAIN_DATA_DIRECTORY: 'relative' },
        { PORCELAIN_TOKEN: 'short' },
      ]) {
        const configured = {
          PORCELAIN_DATA_DIRECTORY: dataDirectory,
          PORCELAIN_TOKEN: token,
          PORCELAIN_PORT: '0',
          ...environment,
        };
        expect(() => readStartupSettings(configured)).toThrow();
      }
      await expect(
        readFile(join(dataDirectory, 'server.lock')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(
        startLocalServer(
          { dataDirectory, token, port: 0 },
          AbortSignal.abort(),
        ),
      ).rejects.toThrow();
      await expect(
        readFile(join(dataDirectory, 'inventory.sqlite')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('owns a directory across aliases, serves loopback HTTP, and releases it on close', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-start-'));
    const dataDirectory = join(root, 'state');
    const server = await startLocalServer({ dataDirectory, token, port: 0 });
    try {
      expect(new URL(server.address).hostname).toBe('127.0.0.1');
      expect(await (await fetch(`${server.address}/health`)).json()).toEqual({
        status: 'ok',
      });
      const alias = join(root, 'alias');
      await symlink(dataDirectory, alias);
      await expect(
        startLocalServer({ dataDirectory: alias, token, port: 0 }),
      ).rejects.toBeInstanceOf(DataDirectoryOwnedError);
      await Promise.all([server.close(), server.close()]);
      await expect(fetch(`${server.address}/health`)).rejects.toThrow();
      const restarted = await startLocalServer({
        dataDirectory,
        token,
        port: 0,
      });
      await restarted.close();
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('releases ownership after bind or database failure so startup can be retried', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-start-'));
    const first = await startLocalServer({
      dataDirectory: join(root, 'first'),
      token,
      port: 0,
    });
    try {
      const dataDirectory = join(root, 'second');
      const port = Number(new URL(first.address).port);
      await expect(
        startLocalServer({ dataDirectory, token, port }),
      ).rejects.toMatchObject({ code: 'EADDRINUSE' });
      const retry = await startLocalServer({ dataDirectory, token, port: 0 });
      await retry.close();
      await writeFile(
        join(dataDirectory, 'inventory.sqlite'),
        'invalid sqlite',
      );
      await expect(
        startLocalServer({ dataDirectory, token, port: 0 }),
      ).rejects.toThrow();
      await expect(
        readFile(join(dataDirectory, 'server.lock')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await first.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
