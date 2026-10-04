import { spawn, type ChildProcess } from 'node:child_process';
import { openSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { mobileRoot } from './development-client.ts';

export type Metro = { url: string; port: number; pid: number; stop(): void };

const readyLimitMs = 3 * 60 * 1000;
const bundleLimitMs = 10 * 60 * 1000;
const pollMs = 500;

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

async function warmBundle(url: string, log: string): Promise<void> {
  const manifest = await fetch(url, {
    headers: {
      'expo-platform': 'ios',
      'expo-protocol-version': '1',
      accept: 'application/expo+json',
    },
    signal: AbortSignal.timeout(readyLimitMs),
  });
  if (!manifest.ok)
    throw new Error(`Metro did not answer the iOS manifest at ${url}`);
  const { launchAsset } = z
    .object({ launchAsset: z.object({ url: z.url() }) })
    .parse(await manifest.json());
  const launch = new URL(launchAsset.url);
  const bundle = new URL(launch.pathname + launch.search, url);
  await appendFile(
    log,
    `\nWarm iOS launch bundle ${launch.href} through ${bundle.href}\n`,
  );
  const response = await fetch(bundle, {
    signal: AbortSignal.timeout(bundleLimitMs),
  }).catch((error: unknown) => {
    throw new Error(
      `Metro could not fetch the iOS launch bundle at ${bundle.href}`,
      {
        cause: error,
      },
    );
  });
  if (!response.ok)
    throw new Error(
      `Metro returned ${response.status} for the iOS launch bundle at ${bundle.href}: ${(await response.text()).slice(0, 1000)}`,
    );
  await response.arrayBuffer();
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
