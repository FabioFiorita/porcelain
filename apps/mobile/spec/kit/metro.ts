import { spawn, type ChildProcess } from 'node:child_process';
import { openSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
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

async function warmBundle(url: string, child: ChildProcess): Promise<void> {
  const bundle = `${url}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp`;
  const deadline = Date.now() + bundleLimitMs;
  while (Date.now() < deadline && !exited(child)) {
    const response = await fetch(bundle, {
      signal: AbortSignal.timeout(bundleLimitMs),
    }).catch(() => undefined);
    if (response?.ok) {
      await response.arrayBuffer();
      return;
    }
    await sleep(pollMs);
  }
  throw new Error(`Metro did not build the iOS bundle at ${url}`);
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
    await warmBundle(url, child);
  } catch (error) {
    stop();
    throw error;
  }
  return { url, port, pid, stop };
}
