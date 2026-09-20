import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  createServer as createHttpServer,
  request as httpRequest,
} from 'node:http';
import { connect } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readStartupSettings } from '../config/startup-settings.ts';
import { pairThroughSocket } from '../development/pair-through-socket.ts';
import { DataDirectoryOwnedError } from './errors/data-directory-owned-error.ts';
import { startRuntime } from './runtime.ts';

/**
 * Well-formed and never minted here: it proves a door refuses a credential,
 * without any shared secret existing to refuse.
 */
const unminted = `pcd_${randomUUID()}_${'x'.repeat(43)}`;

type Response = { status: number; type: string; body: string };

function read(
  target:
    | { socketPath: string; address?: never }
    | { address: string; socketPath?: never },
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const where =
    'socketPath' in target
      ? { socketPath: target.socketPath }
      : {
          host: new URL(target.address).hostname,
          port: Number(new URL(target.address).port),
        };
  return new Promise((resolve, reject) => {
    const call = httpRequest(
      // No keep-alive: a pooled socket would hold the listener open on close.
      { ...where, path, method: 'GET', headers, agent: false },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            type: response.headers['content-type'] ?? '',
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    call.on('error', reject);
    call.end();
  });
}

/** A socket file left behind by a process that died while listening on it. */
function abandonSocket(socketPath: string) {
  try {
    execFileSync(
      process.execPath,
      [
        '-e',
        `require('node:net').createServer().listen(${JSON.stringify(socketPath)}, () => process.kill(process.pid, 'SIGKILL'));`,
      ],
      { stdio: 'ignore' },
    );
  } catch {
    // The child kills itself once the socket exists; that exit is the point.
  }
}

async function settings(root: string, extra: Record<string, unknown> = {}) {
  return {
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    port: 0,
    ...extra,
  };
}

describe('Runtime', () => {
  it('serves both doors, restricts the owner socket, and releases them on close', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-'));
    const runtime = await startRuntime(await settings(root));
    try {
      expect(new URL(runtime.address).hostname).toBe('127.0.0.1');
      expect(
        await (await fetch(`${runtime.address}/api/health`)).json(),
      ).toMatchObject({ status: 'ok' });
      // Without a web root there is no shell to fall through to: the owner
      // route simply is not on this listener.
      const missing = await fetch(`${runtime.address}/status`);
      expect(missing.status).toBe(404);
      await missing.text();
      expect((await stat(runtime.socketPath)).mode & 0o777).toBe(0o600);
      const status = await read({ socketPath: runtime.socketPath }, '/status');
      expect(status.status).toBe(200);
      expect(JSON.parse(status.body)).toEqual({
        address: runtime.address,
        dataDirectory: join(root, 'state'),
        pid: process.pid,
      });
      await Promise.all([runtime.close(), runtime.close()]);
      await expect(fetch(`${runtime.address}/api/health`)).rejects.toThrow();
      await expect(
        read({ socketPath: runtime.socketPath }, '/status'),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps owner and network doors on separate transports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-doors-'));
    const webRoot = join(root, 'web');
    await mkdir(webRoot, { recursive: true });
    await writeFile(join(webRoot, 'index.html'), '<!doctype html>\n');
    const runtime = await startRuntime(await settings(root, { webRoot }));
    try {
      // The owner route does not exist on the network, credentials or not.
      // With a web root the path falls through to the app shell, which must
      // never be the owner's answer.
      for (const headers of [{}, { authorization: `Bearer ${unminted}` }]) {
        const response = await read(
          { address: runtime.address },
          '/status',
          headers,
        );
        expect(response.type).toContain('text/html');
        expect(response.body).not.toContain('dataDirectory');
      }
      // And the network's routes do not exist on the owner socket.
      for (const path of ['/api/inventory', '/api/mcp', '/index.html', '/']) {
        const response = await read({ socketPath: runtime.socketPath }, path, {
          authorization: `Bearer ${unminted}`,
        });
        expect(response.status, path).toBe(404);
      }
      expect((await read({ address: runtime.address }, '/')).status).toBe(200);
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses a second server while one answers, including through an alias', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-owned-'));
    const runtime = await startRuntime(await settings(root));
    try {
      const alias = join(root, 'alias');
      await symlink(join(root, 'state'), alias);
      await expect(
        startRuntime(await settings(root, { dataDirectory: alias })),
      ).rejects.toBeInstanceOf(DataDirectoryOwnedError);
      // The refused start left the live server untouched.
      expect(
        await (await fetch(`${runtime.address}/api/health`)).json(),
      ).toMatchObject({ status: 'ok' });
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('makes a contender wait for a starter that has claimed but not bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-race-'));
    const claimed = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const winner = startRuntime(await settings(root), undefined, {
      onClaimed: async () => {
        claimed.resolve();
        await release.promise;
      },
    });
    let started: Awaited<typeof winner> | undefined;
    try {
      await claimed.promise;
      const contender = startRuntime(await settings(root));
      const order: string[] = [];
      const contended = contender.then(
        (runtime) => {
          order.push('contender');
          return runtime;
        },
        (error: unknown) => {
          order.push('contender');
          return error;
        },
      );
      // The contender cannot decide anything while the winner holds the lock.
      expect(order).toEqual([]);
      release.resolve();
      started = await winner;
      order.push('winner');
      const outcome = await contended;
      expect(order).toEqual(['winner', 'contender']);
      // It waited, then found a live server rather than removing its socket.
      expect(outcome).toBeInstanceOf(DataDirectoryOwnedError);
      expect((await stat(started.socketPath)).mode & 0o777).toBe(0o600);
      expect(
        await (await fetch(`${started.address}/api/health`)).json(),
      ).toMatchObject({ status: 'ok' });
    } finally {
      release.resolve();
      await (started ?? (await winner)).close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('replaces a socket left behind by a crash without any manual cleanup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-stale-'));
    const dataDirectory = join(root, 'state');
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    const socketPath = join(dataDirectory, 'server.sock');
    abandonSocket(socketPath);
    expect((await stat(socketPath)).isSocket()).toBe(true);
    const runtime = await startRuntime(await settings(root));
    try {
      expect(runtime.socketPath).toBe(socketPath);
      expect((await read({ socketPath }, '/status')).status).toBe(200);
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('never removes a socket it cannot identify', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-foreign-'));
    const dataDirectory = join(root, 'state');
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    const socketPath = join(dataDirectory, 'server.sock');
    // Something else is listening there. It accepts connections, so a bare
    // connect test would have called it Porcelain; it is not, and it is also
    // not a crash leftover, so it must survive.
    const foreign = createHttpServer((_request, response) => {
      response.writeHead(500);
      response.end();
    });
    await new Promise<void>((resolve) =>
      foreign.listen(socketPath, () => resolve()),
    );
    try {
      await expect(startRuntime(await settings(root))).rejects.toMatchObject({
        name: 'OwnerSocketUnreadableError',
      });
      expect((await stat(socketPath)).isSocket()).toBe(true);
      await expect(
        readFile(join(dataDirectory, 'inventory.sqlite')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      foreign.closeAllConnections();
      await new Promise<void>((resolve) => foreign.close(() => resolve()));
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses a data directory other users can reach', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-mode-'));
    const dataDirectory = join(root, 'state');
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    // `mkdir` never tightens an existing directory, so the runtime must check.
    await chmod(dataDirectory, 0o755);
    try {
      await expect(startRuntime(await settings(root))).rejects.toMatchObject({
        name: 'DataDirectoryInsecureError',
      });
      await expect(
        readFile(join(dataDirectory, 'inventory.sqlite')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await chmod(dataDirectory, 0o700);
      const runtime = await startRuntime(await settings(root));
      await runtime.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails clearly when the socket path exceeds the platform limit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-long-'));
    const deep = join(root, 'd'.repeat(90), 'e'.repeat(90));
    try {
      await expect(
        startRuntime(await settings(root, { dataDirectory: deep })),
      ).rejects.toMatchObject({ name: 'SocketPathTooLongError' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('leaves nothing running when either door fails to bind', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-partial-'));
    const occupant = await startRuntime(
      await settings(root, { dataDirectory: join(root, 'occupant') }),
    );
    try {
      const port = Number(new URL(occupant.address).port);
      const dataDirectory = join(root, 'state');
      // The network door fails first: no owner socket may survive it.
      await expect(
        startRuntime(await settings(root, { dataDirectory, port })),
      ).rejects.toMatchObject({ code: 'EADDRINUSE' });
      await expect(
        stat(join(dataDirectory, 'server.sock')),
      ).rejects.toMatchObject({ code: 'ENOENT' });

      // The owner door fails second: the bound network listener must close.
      const blocked = join(root, 'blocked');
      await mkdir(blocked, { recursive: true, mode: 0o700 });
      let networkAddress: string | undefined;
      await expect(
        startRuntime(
          await settings(root, { dataDirectory: blocked }),
          undefined,
          {
            // Block the socket path only once the network door is open, so the
            // owner bind is what fails.
            onNetworkBound: async (address) => {
              networkAddress = address;
              await mkdir(join(blocked, 'server.sock'), { recursive: true });
            },
          },
        ),
      ).rejects.toThrow();
      expect(networkAddress).toBeDefined();
      await expect(
        read({ address: networkAddress as string }, '/api/health'),
      ).rejects.toMatchObject({ code: 'ECONNREFUSED' });

      // After both failures the directory is startable again.
      const retry = await startRuntime(await settings(root, { dataDirectory }));
      await retry.close();
    } finally {
      await occupant.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid configuration before creating state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-config-'));
    try {
      const dataDirectory = join(root, 'state');
      for (const environment of [
        { PORCELAIN_PORT: undefined },
        { PORCELAIN_PORT: '' },
        { PORCELAIN_PORT: '1.5' },
        { PORCELAIN_PORT: '65536' },
        { PORCELAIN_HOST: '0.0.0.0/unsafe' },
        { PORCELAIN_WEB_ROOT: 'relative/web' },
        { PORCELAIN_DATA_DIRECTORY: 'relative' },
      ]) {
        const configured = {
          PORCELAIN_DATA_DIRECTORY: dataDirectory,
          PORCELAIN_PROJECT_HOME: join(root, 'home'),
          PORCELAIN_PORT: '0',
          ...environment,
        };
        expect(() => readStartupSettings(configured)).toThrow();
      }
      await expect(
        startRuntime(await settings(root), AbortSignal.abort()),
      ).rejects.toThrow();
      await expect(
        readFile(join(dataDirectory, 'inventory.sqlite')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      expect(
        readStartupSettings({
          PORCELAIN_DATA_DIRECTORY: dataDirectory,
          PORCELAIN_PROJECT_HOME: join(root, 'home'),
          PORCELAIN_PORT: '0',
          PORCELAIN_HOST: '0.0.0.0',
          PORCELAIN_WEB_ROOT: '/srv/porcelain/web',
        }),
      ).toMatchObject({ host: '0.0.0.0', webRoot: '/srv/porcelain/web' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps ownership until the old application has finished draining', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-handover-'));
    const first = await startRuntime(await settings(root));
    // Stall an in-flight request so the network door cannot close promptly.
    const stalled = connect({
      host: '127.0.0.1',
      port: Number(new URL(first.address).port),
    });
    try {
      await new Promise<void>((resolve, reject) => {
        stalled.once('error', reject);
        stalled.once('connect', () => resolve());
      });
      // Authenticated on purpose: a refused request never reaches the body,
      // so it would not stall anything and this test would prove nothing.
      const credential = await pairThroughSocket(
        first.socketPath,
        first.address,
        'Drain fixture',
      );
      stalled.write(
        `POST /api/projects HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer ${credential}\r\nContent-Length: 100\r\n\r\n{`,
      );
      await read({ address: first.address }, '/api/health');

      const closing = first.close();
      let settled = false;
      void closing.then(() => {
        settled = true;
      });
      // While the first server drains it still owns the directory, so a second
      // one cannot open the same database behind its back.
      for (let attempt = 0; attempt < 4; attempt++) {
        await expect(startRuntime(await settings(root))).rejects.toBeInstanceOf(
          DataDirectoryOwnedError,
        );
        expect(settled).toBe(false);
      }
      stalled.destroy();
      await closing;
      // Once it has finished, the directory is free.
      const second = await startRuntime(await settings(root));
      await second.close();
    } finally {
      stalled.destroy();
      await first.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15000);

  it('pairs at every address it answers on when bound to every interface', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-lan-'));
    // What `serve --lan` does. The request hook accepts a connection arriving
    // on any interface, so a pairing link must be allowed to name the same
    // address — these two disagreed once, and the owner met it as the server
    // refusing the address it was answering on.
    const runtime = await startRuntime(
      await settings(root, { host: '0.0.0.0' }),
    );
    try {
      const port = Number(new URL(runtime.address).port);
      const local = Object.values(networkInterfaces())
        .flatMap((entries) => entries ?? [])
        .find((entry) => entry.family === 'IPv4' && !entry.internal);
      if (!local) return;

      // The door answers a request that genuinely arrives on that address.
      const served = await read(
        { address: `http://${local.address}:${port}` },
        '/api/health',
      );
      expect(served.status).toBe(200);

      // And pairing accepts a link pointing at it.
      const [issued] = await runtime.issuePairing(
        ['iPhone'],
        [`http://${local.address}:${port}`],
      );
      expect(issued?.link).toContain(`http://${local.address}:${port}/pair#`);

      // A different machine on the same network is still refused.
      await expect(
        runtime.issuePairing(['iPhone'], [`http://198.51.100.7:${port}`]),
      ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses a link in a family it did not bind', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-family-'));
    // `--lan` binds IPv4 only, so nothing answers on [::1]. Offering a link
    // there would give the owner one to paste into a device that cannot use it.
    const runtime = await startRuntime(
      await settings(root, { host: '0.0.0.0' }),
    );
    try {
      const port = Number(new URL(runtime.address).port);
      await expect(
        runtime.issuePairing(['iPhone'], [`http://[::1]:${port}`]),
      ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
      // The door agrees: it cannot be reached there at all.
      await expect(fetch(`http://[::1]:${port}/api/health`)).rejects.toThrow();
      // IPv4 loopback is bound, so it is offered.
      const [issued] = await runtime.issuePairing(
        ['iPhone'],
        [`http://127.0.0.1:${port}`],
      );
      expect(issued).toBeDefined();
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('offers only the address it bound when given one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-single-'));
    const runtime = await startRuntime(
      await settings(root, { host: '127.0.0.2' }),
    );
    try {
      const port = Number(new URL(runtime.address).port);
      const [issued] = await runtime.issuePairing(
        ['iPhone'],
        [`http://127.0.0.2:${port}`],
      );
      expect(issued).toBeDefined();
      // A server bound to one loopback address does not answer on another, and
      // `localhost` resolves to 127.0.0.1, not to this one.
      for (const origin of [
        `http://127.0.0.1:${port}`,
        `http://localhost:${port}`,
      ])
        await expect(
          runtime.issuePairing(['iPhone'], [origin]),
          origin,
        ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('binds an explicitly configured host without changing the default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-host-'));
    const runtime = await startRuntime(
      await settings(root, { host: '127.0.0.2' }),
    );
    try {
      expect(new URL(runtime.address).hostname).toBe('127.0.0.2');
      expect(
        await (await fetch(`${runtime.address}/api/health`)).json(),
      ).toMatchObject({ status: 'ok' });
    } finally {
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('bounds shutdown when a client never finishes its request body', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-runtime-drain-'));
    const runtime = await startRuntime(await settings(root));
    const socket = connect({
      host: '127.0.0.1',
      port: Number(new URL(runtime.address).port),
    });
    const disconnected = new Promise<void>((resolve) =>
      socket.once('close', () => resolve()),
    );
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.once('connect', resolve);
      });
      const credential = await pairThroughSocket(
        runtime.socketPath,
        runtime.address,
        'Drain fixture',
      );
      socket.write(
        `POST /api/projects HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer ${credential}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`,
      );
      // A pipelined health request cannot complete until this body is consumed.
      await fetch(`${runtime.address}/api/health`);
      await runtime.close();
      await disconnected;
      const restarted = await startRuntime(await settings(root));
      await restarted.close();
    } finally {
      socket.destroy();
      await runtime.close();
      await rm(root, { recursive: true, force: true });
    }
  }, 15000);
});
