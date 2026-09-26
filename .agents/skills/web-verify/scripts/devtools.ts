import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, openSync, closeSync, readdirSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  issuePairingResponseSchema,
  pairingLink,
} from '@porcelain/contracts/access';
import { buildIsolatedServer } from '../../../../scripts/dev-server.ts';
import { IsolatedServer } from '../../server-verify/scripts/session.ts';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const identity = createHash('sha256')
  .update(repositoryRoot)
  .digest('hex')
  .slice(0, 12);
const folder = join(tmpdir(), `porcelain-web-devtools-${identity}`);
const statePath = join(folder, 'session.json');
const failurePath = join(folder, 'failure.txt');
const logPath = join(folder, 'host.log');
const cli = resolve(repositoryRoot, 'node_modules/.bin/chrome-devtools');
const stateSchema = z.object({
  pid: z.number(),
  origin: z.string().url(),
  serverAddress: z.string().url(),
  evidence: z.string(),
  socketPath: z.string(),
});
type State = z.output<typeof stateSchema>;
const usage =
  'Usage: pnpm devtools start|status|pair <pageId>|stop|<chrome-devtools command> [arguments]\n';

async function state(): Promise<State | undefined> {
  try {
    return stateSchema.parse(JSON.parse(await readFile(statePath, 'utf8')));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function command(
  args: string[],
): Promise<{ code: number; output: string }> {
  return new Promise((done, fail) => {
    const child = spawn(cli, args, {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.once('error', fail);
    child.once('close', (code) => done({ code: code ?? 1, output }));
  });
}

function commandFailed(result: { code: number; output: string }) {
  return result.code !== 0 || result.output.includes('Protocol error');
}

async function issueBrowserLink(current: State): Promise<string> {
  const body = JSON.stringify({
    labels: ['DevTools browser'],
    addresses: [current.serverAddress],
  });
  const response = await new Promise<string>((done, fail) => {
    const outgoing = httpRequest(
      {
        socketPath: current.socketPath,
        path: '/pairings',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.once('error', fail);
        incoming.once('end', () => {
          if (incoming.statusCode !== 200)
            fail(new Error(`Pairing grant answered ${incoming.statusCode}`));
          else done(Buffer.concat(chunks).toString('utf8'));
        });
      },
    );
    outgoing.once('error', fail);
    outgoing.end(body);
  });
  const grant = issuePairingResponseSchema.parse(JSON.parse(response))
    .grants[0];
  if (!grant) throw new Error('The isolated server issued no pairing grant');
  return pairingLink({
    ...grant.link,
    addresses: [current.origin.slice(0, -1)],
  });
}

async function pairPage(pageId: string): Promise<void> {
  const current = await state();
  if (!current || !alive(current.pid))
    throw new Error('Run pnpm devtools start first.');
  if (!/^\d+$/.test(pageId)) throw new Error('pair needs a page ID.');
  const link = await issueBrowserLink(current);
  const opened = await command([
    'navigate_page',
    pageId,
    '--type=url',
    `--url=${link}`,
    '--output-format=json',
  ]);
  if (commandFailed(opened)) throw new Error('Could not open the pairing link');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await command([
      'take_snapshot',
      pageId,
      '--output-format=json',
    ]);
    if (commandFailed(snapshot))
      throw new Error('Could not inspect the paired browser');
    if (snapshot.output.includes('Review content')) {
      process.stdout.write(
        `Paired DevTools page ${pageId}: ${current.origin}\n`,
      );
      return;
    }
    await new Promise<void>((done) => setTimeout(done, 250));
  }
  throw new Error('Pairing did not reach the connected review screen');
}

function viteAddress(child: ChildProcess): Promise<string> {
  return new Promise((done, fail) => {
    let output = '';
    const timer = setTimeout(
      () => fail(new Error(`Vite did not start: ${output}`)),
      30_000,
    );
    const inspect = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      const match = output.match(/https?:\/\/127\.0\.0\.1:\d+\//);
      if (match) {
        clearTimeout(timer);
        done(match[0]);
      }
    };
    child.stdout?.on('data', inspect);
    child.stderr?.on('data', inspect);
    child.once('exit', (code) => {
      clearTimeout(timer);
      fail(new Error(`Vite exited ${code}: ${output}`));
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((done) => child.once('exit', () => done()));
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise<void>((done) => setTimeout(done, 5_000)),
  ]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

function chromePath(): string {
  const installed = join(homedir(), '.cache/porcelain/chrome/chrome');
  const builds = existsSync(installed)
    ? readdirSync(installed)
        .filter((name) => name.startsWith('linux-'))
        .toSorted()
        .toReversed()
        .map((name) => join(installed, name, 'chrome-linux64/chrome'))
    : [];
  const paths = [
    process.env.PORCELAIN_CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    ...builds,
  ];
  const found = paths.find((path) => path && existsSync(path));
  if (!found)
    throw new Error(
      'Chrome for Testing or Google Chrome is required; set PORCELAIN_CHROME_PATH to its executable.',
    );
  return found;
}

async function host(): Promise<void> {
  const build = await mkdtemp(join(tmpdir(), 'porcelain-web-server-'));
  const evidence = await mkdtemp(
    join(tmpdir(), 'porcelain-web-devtools-evidence-'),
  );
  let server: IsolatedServer | undefined;
  let vite: ChildProcess | undefined;
  let ownsChrome = false;
  try {
    await buildIsolatedServer(build);
    server = await IsolatedServer.start(repositoryRoot, build);
    vite = spawn(
      resolve(repositoryRoot, 'apps/web/node_modules/.bin/vite'),
      ['--host', '127.0.0.1', '--port', '0'],
      {
        cwd: resolve(repositoryRoot, 'apps/web'),
        env: { ...process.env, PORCELAIN_API_TARGET: server.address },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const origin = await viteAddress(vite);
    const args = [
      'start',
      '--headless',
      '--isolated',
      `--executablePath=${chromePath()}`,
      `--workspace=${repositoryRoot}`,
      `--workspace=${evidence}`,
      '--no-performance-crux',
      '--no-usage-statistics',
    ];
    if (process.env.PORCELAIN_CHROME_NO_SANDBOX === '1')
      args.push('--chromeArg=--no-sandbox');
    const started = await command(args);
    if (commandFailed(started)) throw new Error(started.output);
    ownsChrome = true;
    const opened = await command(['new_page', origin]);
    if (commandFailed(opened))
      throw new Error(
        `${opened.output}\nChrome closed during startup. Set PORCELAIN_CHROME_NO_SANDBOX=1 if this host cannot launch its sandbox.`,
      );
    const pages = await command(['list_pages', '--output-format=json']);
    if (commandFailed(pages))
      throw new Error(
        `${pages.output}\nChrome closed during startup. Set PORCELAIN_CHROME_NO_SANDBOX=1 if this host cannot launch its sandbox.`,
      );
    await writeFile(
      statePath,
      JSON.stringify({
        pid: process.pid,
        origin,
        evidence,
        socketPath: server.socketPath,
        serverAddress: server.address,
      }),
      { mode: 0o600 },
    );
    await new Promise<void>((done) => {
      process.once('SIGTERM', done);
      process.once('SIGINT', done);
    });
  } catch (error) {
    await writeFile(
      failurePath,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await rm(statePath, { force: true });
    if (ownsChrome) await command(['stop']);
    if (vite) await stopChild(vite);
    await server?.stop();
    await rm(build, { recursive: true, force: true });
    process.stdout.write(`DevTools evidence: ${evidence}\n`);
  }
}

async function start(): Promise<void> {
  const existing = await state();
  if (existing && alive(existing.pid)) {
    process.stdout.write(
      `DevTools web: ${existing.origin}\nEvidence: ${existing.evidence}\n`,
    );
    return;
  }
  const daemon = await command(['status']);
  if (daemon.output.includes('daemon is running'))
    throw new Error(
      'Chrome DevTools CLI already has a daemon; stop that session before starting Porcelain.',
    );
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  await rm(statePath, { force: true });
  await rm(failurePath, { force: true });
  const log = openSync(logPath, 'a');
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), 'host'],
    {
      cwd: repositoryRoot,
      detached: true,
      stdio: ['ignore', log, log],
      env: process.env,
    },
  );
  closeSync(log);
  child.unref();
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const ready = await state();
    if (ready) {
      process.stdout.write(
        `DevTools web: ${ready.origin}\nEvidence: ${ready.evidence}\n`,
      );
      return;
    }
    try {
      throw new Error(await readFile(failurePath, 'utf8'));
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error;
    }
    if (!alive(child.pid ?? -1))
      throw new Error(`DevTools host exited; read ${logPath}`);
    await new Promise<void>((done) => setTimeout(done, 100));
  }
  child.kill('SIGTERM');
  throw new Error(`DevTools host did not start; read ${logPath}`);
}

const action = process.argv[2];
if (action === 'host') await host();
else if (action === 'start') await start();
else if (action === 'status') {
  const current = await state();
  process.stdout.write(
    current && alive(current.pid)
      ? `DevTools web: ${current.origin}\nEvidence: ${current.evidence}\n`
      : 'DevTools web is stopped.\n',
  );
} else if (action === 'stop') {
  const current = await state();
  if (current && alive(current.pid)) {
    process.kill(current.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 200 && (await state()); attempt += 1)
      await new Promise<void>((done) => setTimeout(done, 100));
    if (await state())
      throw new Error(`DevTools host did not stop; read ${logPath}`);
  }
  process.stdout.write('DevTools web stopped.\n');
} else if (action === 'pair') {
  if (process.argv.length !== 4) throw new Error(usage);
  await pairPage(process.argv[3] ?? '');
} else if (action) {
  const current = await state();
  if (!current || !alive(current.pid))
    throw new Error('Run pnpm devtools start first.');
  const result = await command(process.argv.slice(2));
  process.stdout.write(result.output);
  process.exitCode = commandFailed(result) ? 1 : 0;
} else {
  process.stderr.write(usage);
  process.exitCode = 2;
}
