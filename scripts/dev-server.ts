import { execFileSync, spawn } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
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

function hostExecutable(name: string): string {
  for (const directory of (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)) {
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return realpathSync(candidate);
    } catch {
      continue;
    }
  }
  throw new Error(`Could not find ${name} on PATH`);
}

function readOnly(path: string): string[] {
  return ['--ro-bind', path, path];
}

try {
  if (process.platform !== 'linux')
    throw new Error('The isolated development server requires Linux and bwrap');
  const node = realpathSync(process.execPath);
  const git = hostExecutable('git');
  const gitExecPath = realpathSync(
    execFileSync(git, ['--exec-path'], { encoding: 'utf8' }).trim(),
  );
  const tools = [...new Set([dirname(node), dirname(git), gitExecPath])];
  const child = spawn(
    'bwrap',
    [
      '--die-with-parent',
      '--unshare-pid',
      '--unshare-ipc',
      ...readOnly('/usr'),
      ...readOnly('/lib'),
      ...(existsSync('/lib64') ? readOnly('/lib64') : []),
      '--dev',
      '/dev',
      '--proc',
      '/proc',
      '--tmpfs',
      '/tmp',
      '--tmpfs',
      '/home',
      ...tools.flatMap(readOnly),
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
      node,
      'scripts/dev-server-child.ts',
    ],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: 'inherit',
      env: {
        PATH: [dirname(git), '/usr/bin', '/bin'].join(delimiter),
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
