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
import { chmod, cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { tmpdir, userInfo } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { z } from 'zod';
import { buildPerfSample } from './perf-sample.ts';

const kit = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(kit, '../../../..');
const CHILD_BUNDLE = 'server/src/bootstrap/dev-server-child.mjs';
const CODING_TOOL_BUNDLE = 'coding-tool/claude.mjs';
const unbundled = [
  { name: 'better-sqlite3', via: [] },
  { name: '@parcel/watcher', via: [] },
  { name: '@stroncium/procfs', via: ['trash'] },
];
const optionalModules = ['bufferutil', 'utf-8-validate'];
const SERVER_MOUNT = '/opt/porcelain/server';
const SANDBOX_PATH = '/opt/porcelain/bin';
const SEATBELT = '/usr/bin/sandbox-exec';
const STOP_GRACE_MS = 10_000;
const packageSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});

type Installation = {
  server: string;
  bin: string;
  serverAt: string;
  binAt: string;
};

type Sandbox = {
  node: string;
  git: string;
  root: string;
  installation: Installation;
  codingTool: string;
  port: number;
};

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

export async function temporaryServerBuild(sample?: 'perf') {
  const folder = await mkdtemp(join(tmpdir(), 'porcelain-server-build-'));
  const remove = () => rm(folder, { recursive: true, force: true });
  try {
    await buildIsolatedServer(folder, sample);
  } catch (error) {
    await remove();
    throw error;
  }
  return { folder, remove };
}

export async function buildIsolatedServer(
  output: string,
  sample?: 'perf',
): Promise<void> {
  if (sample === 'perf') await buildPerfSample(output);
  await build({
    entryPoints: [join(kit, 'sandboxed-server.ts')],
    outfile: join(output, CHILD_BUNDLE),
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
        "import { runCodingTool } from './coding-tool.ts'; runCodingTool();",
      resolveDir: kit,
      loader: 'ts',
    },
    outfile: join(output, CODING_TOOL_BUNDLE),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    banner: { js: `#!${realpathSync(process.execPath)}` },
    logLevel: 'warning',
  });
  await chmod(join(output, CODING_TOOL_BUNDLE), 0o755);
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

function linkedLibraries(binary: string): string[] {
  const [command, args, pattern] =
    process.platform === 'darwin'
      ? (['otool', ['-L', binary], /^\s+(\/\S+)\s+\(compat/] as const)
      : (['ldd', [binary], /(?:=>\s*)?(\/\S+)\s+\(0x/] as const);
  let output: string;
  try {
    output = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }
  return output.split('\n').flatMap((line) => {
    const path = pattern.exec(line)?.[1];
    return path ? [path] : [];
  });
}

function sharedLibraries(binaries: readonly string[]): string[] {
  const libraries = new Set<string>();
  const pending = [...binaries];
  for (let binary = pending.pop(); binary; binary = pending.pop())
    for (const library of linkedLibraries(binary))
      if (!libraries.has(library) && existsSync(library)) {
        libraries.add(library);
        if (process.platform === 'darwin') pending.push(library);
      }
  return [...libraries];
}

function gitTemplates(execPath: string): string {
  return resolve(execPath, '../../share/git-core');
}

function gitExecutables(git: string): {
  named: string;
  execPath: string;
  templates: string;
} {
  const named = execFileSync(git, ['--exec-path'], { encoding: 'utf8' }).trim();
  const execPath = realpathSync(named);
  return { named, execPath, templates: gitTemplates(execPath) };
}

function gitSystemConfig(git: string): string[] {
  try {
    const path = execFileSync(git, ['var', 'GIT_CONFIG_SYSTEM'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return existsSync(path) ? [path, realpathSync(path)] : [];
  } catch {
    return [];
  }
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

function bubblewrapArguments(sandbox: Sandbox): string[] {
  const { node, git, root, installation } = sandbox;
  const { execPath, templates } = gitExecutables(git);
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
    ...readOnly(execPath),
    ...(existsSync(templates) ? readOnly(templates) : []),
    ...(existsSync('/etc/ld.so.cache') ? readOnly('/etc/ld.so.cache') : []),
    ...libraryMounts(
      sharedLibraries([node, git, ...addons(installation.server)]),
    ),
    ...readOnly(installation.server, installation.serverAt),
    ...readOnly(installation.bin, installation.binAt),
    '--bind',
    root,
    root,
    '--chdir',
    root,
    '--',
    node,
    join(installation.serverAt, CHILD_BUNDLE),
  ];
}

function quoted(path: string): string {
  return JSON.stringify(path);
}

function filters(kind: 'literal' | 'subpath', paths: readonly string[]) {
  return [...new Set(paths)]
    .map((path) => `(${kind} ${quoted(path)})`)
    .join(' ');
}

function ancestors(paths: readonly string[]): string[] {
  const found = new Set<string>();
  for (const path of paths)
    for (
      let directory = dirname(path);
      !found.has(directory);
      directory = dirname(directory)
    )
      found.add(directory);
  return [...found];
}

function seatbeltProfile(sandbox: Sandbox): string {
  const { node, git, root, installation, codingTool, port } = sandbox;
  const { named, execPath, templates } = gitExecutables(git);
  const gitFolders = [execPath, templates, named, gitTemplates(named)];
  const libraries = sharedLibraries([
    node,
    git,
    ...addons(installation.server),
  ]).flatMap((library) => [library, realpathSync(library)]);
  const folder = dirname(installation.server);
  const programs = [node, git, codingTool];
  const readable = [...programs, ...libraries, ...gitSystemConfig(git)];
  const quiet = [
    '/AppleInternal',
    join(userInfo().homedir, '.CFUserTextEncoding'),
    ...[execPath, named].map((path) => resolve(path, '../../share/locale')),
  ];
  return [
    '(version 1)',
    '(deny default)',
    '(import "system.sb")',
    '(allow process-fork)',
    '(allow signal (target same-sandbox))',
    '(allow process-info* (target same-sandbox))',
    `(allow process-exec ${filters('literal', programs)} ${filters('subpath', [execPath, named, installation.bin])})`,
    `(allow file-read* ${filters('literal', readable)} ${filters('subpath', [...gitFolders, folder, root])})`,
    `(allow file-map-executable ${filters('literal', libraries)} ${filters('subpath', [installation.server])})`,
    `(allow file-read-metadata ${filters('literal', ancestors([...readable, ...gitFolders, folder, root]))})`,
    `(allow file-read-data ${filters('literal', ancestors([folder, root]))})`,
    `(allow file-write* ${filters('subpath', [root])})`,
    `(allow network-bind network-inbound (local ip "localhost:${port}"))`,
    `(allow network-outbound (remote ip "localhost:${port}"))`,
    `(allow network-bind network-outbound ${filters('subpath', [root])})`,
    '(allow mach-lookup (global-name "com.apple.FSEvents"))',
    '(deny system-info user-preference-read (with no-log))',
    `(deny file-read* ${filters('literal', quiet)} (with no-log))`,
  ].join('\n');
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

function freePort(): Promise<number> {
  const probe = createServer();
  return new Promise((resolvePort, rejectPort) => {
    probe.once('error', rejectPort);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = probe.address();
      probe.close(() =>
        address === null || typeof address === 'string'
          ? rejectPort(new Error('The loopback probe has no port'))
          : resolvePort(address.port),
      );
    });
  });
}

function sampleOption(): 'perf' | undefined {
  return process.env.PORCELAIN_DEV_SAMPLE === 'perf' ? 'perf' : undefined;
}

function serverOption(): string | undefined {
  const at = process.argv.indexOf('--server');
  return at === -1 ? undefined : process.argv[at + 1];
}

function scratchFolder(): string {
  return process.platform === 'darwin' ? '/tmp' : tmpdir();
}

async function temporary(prefix: string, scratch: string[]): Promise<string> {
  const path = realpathSync(await mkdtemp(join(scratchFolder(), prefix)));
  scratch.push(path);
  return path;
}

async function install(
  given: string | undefined,
  scratch: string[],
): Promise<Installation> {
  if (process.platform === 'linux') {
    const bin = await temporary('porcelain-dev-bin-', scratch);
    const built =
      given === undefined
        ? await temporary('porcelain-dev-build-', scratch)
        : undefined;
    if (built !== undefined) await buildIsolatedServer(built, sampleOption());
    return {
      server: realpathSync(given ?? built ?? ''),
      bin,
      serverAt: SERVER_MOUNT,
      binAt: SANDBOX_PATH,
    };
  }
  if (process.platform !== 'darwin')
    throw new Error(
      'The isolated development server requires Linux with bwrap or macOS',
    );
  const folder = await temporary('porcelain-dev-opt-', scratch);
  const server = join(folder, 'server');
  const bin = join(folder, 'bin');
  await mkdir(bin);
  if (given === undefined) await buildIsolatedServer(server, sampleOption());
  else
    await cp(realpathSync(given), server, {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
    });
  return { server, bin, serverAt: server, binAt: bin };
}

async function main() {
  const scratch: string[] = [];
  const root = await temporary('porcelain-dev-', scratch);
  const given = serverOption();
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
    const confine =
      process.platform === 'linux' ? hostExecutable('bwrap') : SEATBELT;
    const git = hostExecutable('git');
    const installation = await install(given, scratch);
    const { bin } = installation;
    const codingToolExecutable = join(
      installation.serverAt,
      CODING_TOOL_BUNDLE,
    );
    await symlink(git, join(bin, 'git'));
    const network =
      process.platform === 'linux'
        ? await relayTo(join(root, 'network.sock'))
        : { relay: undefined, port: await freePort() };
    relay = network.relay;
    const sandbox: Sandbox = {
      node: realpathSync(process.execPath),
      git,
      root,
      installation,
      codingTool: codingToolExecutable,
      port: network.port,
    };
    const child = spawn(
      confine,
      process.platform === 'linux'
        ? bubblewrapArguments(sandbox)
        : [
            '-p',
            seatbeltProfile(sandbox),
            sandbox.node,
            join(installation.serverAt, CHILD_BUNDLE),
          ],
      {
        cwd: root,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: installation.binAt,
          HOME: root,
          TMPDIR: root,
          PORCELAIN_DEV_ROOT: root,
          PORCELAIN_DEV_BIN: bin,
          PORCELAIN_DEV_INSTALLATION: dirname(installation.serverAt),
          PORCELAIN_DEV_CODING_TOOL: codingToolExecutable,
          PORCELAIN_DEV_PORT: String(network.port),
          ...(process.platform === 'darwin' ? { TRASH_FALLBACK: '1' } : {}),
          ...(process.env.PORCELAIN_DEV_SAMPLE === 'review' ||
          process.env.PORCELAIN_DEV_SAMPLE === 'perf'
            ? { PORCELAIN_DEV_SAMPLE: process.env.PORCELAIN_DEV_SAMPLE }
            : {}),
        },
      },
    );
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    stopChild = () => {
      child.stdin.end();
      setTimeout(() => child.kill('SIGKILL'), STOP_GRACE_MS).unref();
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
    for (const path of scratch)
      await rm(path, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
