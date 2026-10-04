import { spawn, type ChildProcess } from 'node:child_process';
import { openSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { mobileRoot } from './development-client.ts';

export type Metro = { url: string; port: number; pid: number; stop(): void };

const readyLimitMs = 3 * 60 * 1000;
const bundleLimitMs = 10 * 60 * 1000;
const pollMs = 500;
const manifestReadyMs = 1000;

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen({ host: '::1', port: 0 }, () => {
      const bound = probe.address();
      probe.close(() =>
        typeof bound === 'object' && bound !== null
          ? done(bound.port)
          : fail(new Error('No free port for Metro')),
      );
    });
  });
}

async function answers(url: string, expected: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok && (await response.text()).includes(expected);
  } catch {
    return false;
  }
}

function exited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function readyManifest(
  url: string,
  log: string,
  deadline = performance.now() + readyLimitMs,
): Promise<Response> {
  const origin = new URL(url);
  const headers = {
    'expo-platform': 'ios',
    accept: 'application/expo+json,application/json',
    'Expo-AppMetrics-Skip': '1',
    Forwarded: `host="${origin.host}";proto=${origin.protocol.slice(0, -1)}`,
    'X-Forwarded-Host': origin.host,
    'X-Forwarded-Proto': origin.protocol.slice(0, -1),
  };
  while (performance.now() < deadline) {
    const began = performance.now();
    let manifest: Response | undefined;
    for (const method of ['HEAD', 'GET']) {
      const requestAt = performance.now();
      const response = await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(
          Math.max(1, Math.ceil(deadline - performance.now())),
        ),
      });
      if (!response.ok)
        throw new Error(
          `Metro returned ${response.status} for ${method} ${url}`,
        );
      manifest = new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: response.headers,
      });
      await appendFile(
        log,
        `${new Date().toISOString()}: iOS manifest ${method} ${url} ${Math.round(performance.now() - requestAt)}ms\n`,
      );
    }
    if (manifest !== undefined && performance.now() - began <= manifestReadyMs)
      return manifest;
    await sleep(pollMs);
  }
  throw new Error(`Metro's iOS manifest did not become responsive at ${url}`);
}

async function warmBundle(
  url: string,
  log: string,
  deadline = performance.now() + bundleLimitMs,
): Promise<void> {
  const manifest = await readyManifest(
    url,
    log,
    Math.min(deadline, performance.now() + readyLimitMs),
  );
  const { launchAsset } = z
    .object({ launchAsset: z.object({ url: z.string().min(1) }) })
    .parse(await manifest.json());
  const launch = new URL(launchAsset.url, url);
  const bundle = new URL(launch.pathname + launch.search, url);
  await appendFile(
    log,
    `\nWarm iOS launch bundle ${launch.href} through ${bundle.href}\n`,
  );
  const began = performance.now();
  const response = await fetch(bundle, {
    signal: AbortSignal.timeout(
      Math.max(1, Math.ceil(deadline - performance.now())),
    ),
  }).catch((error: unknown) => {
    throw new Error(
      `Metro could not fetch the iOS launch bundle at ${bundle.href}`,
      {
        cause: error,
      },
    );
  });
  await appendFile(
    log,
    `${new Date().toISOString()}: iOS bundle ${bundle.href} ${Math.round(performance.now() - began)}ms; status ${response.status}\n`,
  );
  if (!response.ok)
    throw new Error(
      `Metro returned ${response.status} for the iOS launch bundle at ${bundle.href}: ${(await response.text()).slice(0, 1000)}`,
    );
  await response.arrayBuffer();
}

export async function launchReadiness(url: string, log: string) {
  const ready = async () => {
    const deadline = performance.now() + readyLimitMs;
    while (performance.now() < deadline) {
      const began = performance.now();
      await warmBundle(url, log, deadline);
      const elapsed = Math.round(performance.now() - began);
      await appendFile(
        log,
        `${new Date().toISOString()}: launch manifest and bundle ${elapsed}ms\n`,
      );
      if (elapsed <= manifestReadyMs) return;
      await sleep(pollMs);
    }
    throw new Error(
      `Metro's launch bundle did not become responsive at ${url}`,
    );
  };
  const server = createHttpServer((_request, response) => {
    void ready().then(
      () => response.end('Metro is ready'),
      (error: unknown) => {
        response.statusCode = 500;
        response.end(String(error));
      },
    );
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new Error('Metro launch readiness has no local port');
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((done, fail) =>
        server.close((error) => (error === undefined ? done() : fail(error))),
      ),
  };
}

export async function startMetro(
  log: string,
  requestedPort?: number,
): Promise<Metro> {
  const port = requestedPort ?? (await freePort());
  const url = `http://localhost:${port}`;
  const output = openSync(log, 'a');
  const child = spawn(
    join(mobileRoot, 'node_modules/.bin/expo'),
    [
      'start',
      '--dev-client',
      '--localhost',
      '--port',
      String(port),
      '--max-workers',
      '2',
    ],
    {
      cwd: mobileRoot,
      detached: true,
      env: { ...process.env, EXPO_NO_TELEMETRY: '1', BROWSER: 'none' },
      stdio: ['ignore', output, output],
    },
  );
  const pid = child.pid;
  if (pid === undefined) throw new Error('Metro did not start');
  const stop = () => {
    if (!exited(child)) process.kill(-pid, 'SIGTERM');
  };
  try {
    const deadline = Date.now() + readyLimitMs;
    while (!(await answers(`${url}/status`, 'packager-status:running'))) {
      if (exited(child) || Date.now() > deadline)
        throw new Error(`Metro did not answer ${url}/status; read ${log}`);
      await sleep(pollMs);
    }
    await warmBundle(url, log);
  } catch (error) {
    stop();
    throw error;
  }
  return { url, port, pid, stop };
}
