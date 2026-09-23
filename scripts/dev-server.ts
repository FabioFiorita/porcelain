import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = await mkdtemp(join(tmpdir(), 'porcelain-dev-'));
let stopping = false;
let childPid: number | undefined;

const stop = () => {
  stopping = true;
  if (!childPid) return;
  try {
    process.kill(-childPid, 'SIGTERM');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH'))
      throw error;
  }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

try {
  if (process.platform !== 'linux')
    throw new Error('The isolated development server currently requires Linux');
  const child = spawn(
    'bwrap',
    [
      '--die-with-parent',
      '--unshare-pid',
      '--unshare-ipc',
      '--ro-bind',
      '/usr',
      '/usr',
      '--ro-bind',
      '/lib',
      '/lib',
      '--ro-bind',
      '/lib64',
      '/lib64',
      '--dev',
      '/dev',
      '--proc',
      '/proc',
      '--tmpfs',
      '/tmp',
      '--tmpfs',
      '/home',
      '--ro-bind',
      repositoryRoot,
      '/workspace',
      '--dir',
      root,
      '--bind',
      root,
      root,
      '--chdir',
      '/workspace',
      '--',
      '/usr/bin/node',
      'scripts/dev-server-child.ts',
    ],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: 'inherit',
      env: {
        PATH: '/usr/bin:/bin',
        HOME: root,
        TMPDIR: root,
        PORCELAIN_DEV_ROOT: root,
      },
    },
  );
  childPid = child.pid;
  if (stopping) stop();
  const code = await new Promise<number | null>((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('close', resolveExit);
  });
  if (!stopping && code !== 0) process.exitCode = code ?? 1;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
  await rm(root, { recursive: true, force: true });
}
