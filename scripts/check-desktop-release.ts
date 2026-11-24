import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import { prepareDisposableMacKeychain } from '../apps/desktop/spec/kit/disposable-mac-keychain.ts';
import { rendererReadyLine } from '../apps/desktop/src/renderer-readiness.ts';
import { LIMITS } from '../apps/server/src/config/limits.ts';

const image = process.argv[2];
if (!image) throw new Error('Pass the signed Porcelain disk image');

const hdiutil = '/usr/bin/hdiutil';
const diskCommandLimit = { timeout: 10_000, killSignal: 'SIGKILL' } as const;

async function detachDiskImage(mount: string): Promise<void> {
  for (const options of [[], [], ['-force']]) {
    const result = spawnSync(hdiutil, ['detach', mount, ...options], {
      stdio: 'inherit',
      ...diskCommandLimit,
    });
    if (result.status === 0) return;
    if (options.length > 0)
      throw new Error(`Could not detach the disk image at ${mount}`, {
        cause: result.error,
      });
    await setTimeout(250);
  }
}

function waitForExit(
  exited: Promise<string>,
  timeout: number,
): Promise<boolean> {
  return Promise.race([
    exited.then(() => true),
    setTimeout(timeout, false, { ref: false }),
  ]);
}

const workspace = mkdtempSync('/tmp/porcelain-release-');
let mount: string | undefined;
let mounted = false;
let stop: (() => Promise<void>) | undefined;
let failure: { error: unknown } | undefined;

try {
  mount = mkdtempSync('/tmp/porcelain-image-');
  const profile = join(workspace, 'profile');
  const projects = join(workspace, 'projects');
  const home = join(workspace, 'home');
  for (const path of [profile, projects, home]) mkdirSync(path);
  execFileSync(
    hdiutil,
    ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, image],
    { stdio: 'inherit', ...diskCommandLimit, timeout: 30_000 },
  );
  mounted = true;
  const env = {
    ...process.env,
    HOME: home,
    PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
  };
  prepareDisposableMacKeychain(home, env);
  const app = spawn(
    join(mount, 'Porcelain.app', 'Contents', 'MacOS', 'Porcelain'),
    ['--data-directory', profile, '--project-home', projects],
    {
      env,
      stdio: ['ignore', 'inherit', 'pipe'],
    },
  );
  const exited = new Promise<string>((resolve) => {
    app.once('error', (error) => resolve(error.message));
    app.once('close', (code, signal) => resolve(String(code ?? signal)));
  });
  stop = async () => {
    app.kill();
    if (await waitForExit(exited, LIMITS.desktop.shutdownMs + 5_000)) return;
    console.error(
      'Porcelain exceeded its graceful shutdown deadline. Sending SIGKILL.',
    );
    app.kill('SIGKILL');
    if (!(await waitForExit(exited, 5_000)))
      throw new Error('Porcelain did not exit after SIGKILL');
  };
  const ready = new Promise<void>((resolve) => {
    createInterface({ input: app.stderr }).on('line', (line) => {
      process.stderr.write(`${line}\n`);
      if (line === rendererReadyLine) resolve();
    });
  });

  await Promise.race([
    ready,
    exited.then((reason) => {
      throw new Error(
        `Porcelain exited before its renderer was ready (${reason})`,
      );
    }),
    setTimeout(30_000, undefined, { ref: false }).then(() => {
      throw new Error(
        'The mounted Porcelain app did not report renderer readiness',
      );
    }),
  ]);
  console.log('The mounted Porcelain app reached renderer readiness.');
} catch (error) {
  failure = { error };
}

const cleanupErrors: unknown[] = [];
try {
  await stop?.();
} catch (error) {
  cleanupErrors.push(error);
}
try {
  if (mount) {
    if (mounted) await detachDiskImage(mount);
    if (existsSync(mount)) rmdirSync(mount);
  }
} catch (error) {
  cleanupErrors.push(error);
}
try {
  rmSync(workspace, { recursive: true, force: true });
} catch (error) {
  cleanupErrors.push(error);
}
if (failure) {
  for (const error of cleanupErrors)
    console.error('Desktop smoke cleanup failed:', error);
  throw failure.error;
}
if (cleanupErrors.length > 0)
  throw new AggregateError(cleanupErrors, 'Desktop smoke cleanup failed');
