import { execFileSync, spawn } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { chmod, cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { z } from 'zod';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const childBundle = 'server/src/bootstrap/dev-server-child.mjs';
const codingToolBundle = 'coding-tool/claude.mjs';
const unbundled = [
  { name: 'better-sqlite3', via: [] },
  { name: '@parcel/watcher', via: [] },
  { name: '@stroncium/procfs', via: ['trash'] },
];
const optionalModules = ['bufferutil', 'utf-8-validate'];
const serverMount = '/opt/porcelain/server';
const sandboxPath = '/opt/porcelain/bin';
export const codingToolExecutable = join(serverMount, codingToolBundle);
const stopGraceMs = 10_000;
const packageSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

function locate(name: string, from: string): string | undefined {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json')))
      return realpathSync(candidate);
    if (dirname(directory) === directory) return undefined;
  }
}

async function vendor(
  name: string,
  from: string,
  into: string,
  copied: Set<string>,
) {
  const source = locate(name, from);
  if (source === undefined) throw new Error(`Could not find ${name}`);
  if (copied.has(name)) return;
  copied.add(name);
  await cp(source, join(into, name), { recursive: true, dereference: true });
  const manifest = packageSchema.parse(
    JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')),
  );
  for (const dependency of Object.keys(manifest.dependencies ?? {}))
    await vendor(dependency, source, into, copied);
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {}))
    if (locate(dependency, source) !== undefined)
      await vendor(dependency, source, into, copied);
}

export async function buildIsolatedServer(output: string): Promise<void> {
  await build({
    entryPoints: [join(repositoryRoot, 'scripts/dev-server-child.ts')],
    outfile: join(output, childBundle),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: [...unbundled.map(({ name }) => name), ...optionalModules],
    banner: {
      js: "import { createRequire as porcelainRequire } from 'node:module'; const require = porcelainRequire(import.meta.url);",
    },
    logLevel: 'warning',
  });
  await build({
    stdin: {
      contents:
        "import { runCodingTool } from './dev-coding-tool.ts'; runCodingTool();",
      resolveDir: join(repositoryRoot, 'scripts'),
      loader: 'ts',
    },
    outfile: join(output, codingToolBundle),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    banner: { js: `#!${realpathSync(process.execPath)}` },
    logLevel: 'warning',
  });
  await chmod(join(output, codingToolBundle), 0o755);
  await cp(
    join(repositoryRoot, 'packages/storage/drizzle'),
    join(output, 'server/drizzle'),
    { recursive: true },
  );
  const copied = new Set<string>();
  for (const { name, via } of unbundled) {
    const from = via.reduce(
      (directory, parent) => locate(parent, directory) ?? directory,
      join(repositoryRoot, 'apps/server'),
    );
    await vendor(name, from, join(output, 'node_modules'), copied);
  }
}

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

function addons(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.node'))
    .map((path) => join(directory, path));
}

function sharedLibraries(binaries: readonly string[]): string[] {
  const libraries = new Set<string>();
  for (const binary of binaries) {
    let output: string;
    try {
      output = execFileSync('ldd', [binary], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      continue;
    }
    for (const line of output.split('\n')) {
      const path = /(?:=>\s*)?(\/\S+)\s+\(0x/.exec(line)?.[1];
      if (path) libraries.add(path);
    }
  }
  return [...libraries];
}

function readOnly(path: string, at = path): string[] {
  return ['--ro-bind', path, at];
}

function libraryMounts(libraries: readonly string[]): string[] {
  const mounted = new Set<string>();
  return libraries.flatMap((library) => {
    const real = realpathSync(library);
    return [real, library].flatMap((at) => {
      if (mounted.has(at)) return [];
      mounted.add(at);
      return readOnly(real, at);
    });
  });
}

function sandboxArguments(
  server: string,
  root: string,
  bin: string,
  git: string,
): string[] {
  const node = realpathSync(process.execPath);
  const gitExecPath = realpathSync(
    execFileSync(git, ['--exec-path'], { encoding: 'utf8' }).trim(),
  );
  const templates = '/usr/share/git-core';
  return [
    '--die-with-parent',
    '--new-session',
    '--unshare-pid',
    '--unshare-ipc',
    '--unshare-net',
    '--dev',
    '/dev',
    '--proc',
    '/proc',
    '--tmpfs',
    '/tmp',
    ...readOnly(node),
    ...readOnly(git),
    ...readOnly(gitExecPath),
    ...(existsSync(templates) ? readOnly(templates) : []),
    ...(existsSync('/etc/ld.so.cache') ? readOnly('/etc/ld.so.cache') : []),
    ...libraryMounts(sharedLibraries([node, git, ...addons(server)])),
    ...readOnly(server, serverMount),
    ...readOnly(bin, sandboxPath),
    '--bind',
    root,
    root,
    '--chdir',
    root,
    '--',
    node,
    join(serverMount, childBundle),
  ];
}

function relayTo(socketPath: string): Promise<{ relay: Server; port: number }> {
  const relay = createServer((incoming) => {
    const outgoing = connect(socketPath);
    incoming.pipe(outgoing).pipe(incoming);
    incoming.on('error', () => outgoing.destroy());
    outgoing.on('error', () => incoming.destroy());
  });
  return new Promise((resolveRelay, rejectRelay) => {
    relay.once('error', rejectRelay);
    relay.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = relay.address();
      if (address === null || typeof address === 'string')
        rejectRelay(new Error('The network relay has no port'));
      else resolveRelay({ relay, port: address.port });
    });
  });
}

function serverOption(): string | undefined {
  const at = process.argv.indexOf('--server');
  return at === -1 ? undefined : process.argv[at + 1];
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-dev-'));
  const bin = await mkdtemp(join(tmpdir(), 'porcelain-dev-bin-'));
  const given = serverOption();
  const built =
    given === undefined
      ? await mkdtemp(join(tmpdir(), 'porcelain-dev-build-'))
      : undefined;
  let stopping = false;
  let relay: Server | undefined;
  let stopChild = () => undefined;
  const stop = () => {
    stopping = true;
    stopChild();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    if (process.platform !== 'linux')
      throw new Error(
        'The isolated development server requires Linux and bwrap',
      );
    const bwrap = hostExecutable('bwrap');
    const git = hostExecutable('git');
    await symlink(git, join(bin, 'git'));
    if (built !== undefined) await buildIsolatedServer(built);
    const server = realpathSync(given ?? built ?? '');
    const network = await relayTo(join(root, 'network.sock'));
    relay = network.relay;
    const child = spawn(bwrap, sandboxArguments(server, root, bin, git), {
      cwd: root,
      detached: true,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: {
        PATH: sandboxPath,
        HOME: root,
        TMPDIR: root,
        PORCELAIN_DEV_ROOT: root,
        PORCELAIN_DEV_BIN: bin,
        PORCELAIN_DEV_PORT: String(network.port),
      },
    });
    stopChild = () => {
      child.stdin.end();
      setTimeout(() => child.kill('SIGKILL'), stopGraceMs).unref();
    };
    if (stopping) stopChild();
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
    relay?.close();
    await rm(root, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
    if (built !== undefined) await rm(built, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
