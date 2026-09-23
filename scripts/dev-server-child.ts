import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { startRuntime, type Runtime } from '../apps/server/src/lifecycle/runtime.ts';

const execute = promisify(execFile);
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const root = process.env.PORCELAIN_DEV_ROOT;
if (!root) throw new Error('Missing development root');
let server: Runtime | undefined;

try {
  const home = join(root, 'home');
  const repository = join(root, 'repository');
  const state = join(root, 'state');
  await mkdir(home);
  Object.assign(process.env, {
    HOME: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_DATA_HOME: join(root, 'data'),
    TMPDIR: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
  });

  const git = async (...args: string[]) => {
    await execute('git', args, { cwd: repository, env: process.env });
  };
  await mkdir(repository);
  await git('init', '-b', 'main');
  await git('config', 'user.name', 'Porcelain Development');
  await git('config', 'user.email', 'porcelain@example.invalid');
  await writeFile(join(repository, 'README.md'), '# Sample repository\n');
  await git('add', 'README.md');
  await git('commit', '-m', 'Initial commit');
  await writeFile(
    join(repository, 'README.md'),
    `${await readFile(join(repository, 'README.md'), 'utf8')}\nA change to review.\n`,
  );

  server = await startRuntime(
    { dataDirectory: state, projectHome: root, port: 0 },
    shutdown.signal,
  );
  const [grant] = await server.issuePairing(
    ['Development setup'],
    [new URL(server.address).origin],
  );
  if (!grant) throw new Error('Could not create a development pairing');
  const paired = await fetch(`${server.address}/api/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: grant.code, platform: 'Development' }),
    signal: shutdown.signal,
  });
  if (!paired.ok) throw new Error(`Development pairing failed: ${paired.status}`);
  const { credential } = (await paired.json()) as { credential?: string };
  if (!credential) throw new Error('Development pairing returned no credential');
  const registered = await fetch(`${server.address}/api/projects`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ path: repository }),
    signal: shutdown.signal,
  });
  if (!registered.ok)
    throw new Error(`Sample repository registration failed: ${registered.status}`);

  const manifest = join(root, 'manifest.json');
  await writeFile(
    manifest,
    `${JSON.stringify({ address: server.address, dataDirectory: state, repository, socketPath: server.socketPath }, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify({ manifest, address: server.address, repository })}\n`);
  if (!shutdown.signal.aborted)
    await new Promise<void>((resolve) =>
      shutdown.signal.addEventListener('abort', () => resolve(), { once: true }),
    );
} catch (error) {
  if (!shutdown.signal.aborted) {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
} finally {
  try {
    await server?.close();
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}
