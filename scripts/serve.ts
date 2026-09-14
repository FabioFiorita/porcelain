import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdir, mkdtemp, open, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  absolutePathSchema,
  listenHostSchema,
} from '../apps/server/src/config/server-settings.ts';
import { startLocalServer } from '../apps/server/src/lifecycle/start-local-server.ts';

const defaultHost = '127.0.0.1';
const defaultPort = 3000;
const defaultTokenFileName = 'admin-token';
const minimumTokenLength = 32;
const tokenPattern = /^[A-Za-z0-9._~-]+$/;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type ServeSettings = {
  dataDirectory: string;
  tokenFile: string;
  host: string;
  port: number;
  webRoot: string;
};

type ServeArguments = {
  dataDirectory?: string;
  tokenFile?: string;
  host?: string;
  port?: number;
  lan: boolean;
  help: boolean;
};

type ServeEnvironment = {
  PORCELAIN_DATA_DIRECTORY?: string;
  PORCELAIN_TOKEN_FILE?: string;
  PORCELAIN_HOST?: string;
  PORCELAIN_PORT?: string;
};

type StartedServer = Awaited<ReturnType<typeof startLocalServer>>;

export type ServeDependencies = {
  buildWeb?: (signal: AbortSignal, outputDirectory: string) => Promise<void>;
  startServer?: typeof startLocalServer;
  output?: (message: string) => void;
  repositoryRoot?: string;
};

export type BuildCommandOptions = {
  cancellationGraceMs?: number;
};

export class ServeConfigurationError extends Error {
  override readonly name = 'ServeConfigurationError';
}

function optionValue(
  args: readonly string[],
  index: number,
  option: string,
): { value: string; nextIndex: number } {
  const argument = args[index];
  if (argument?.startsWith(`${option}=`)) {
    const value = argument.slice(option.length + 1);
    if (value.length > 0) return { value, nextIndex: index };
  }
  const value = args[index + 1];
  if (value !== undefined && !value.startsWith('--'))
    return { value, nextIndex: index + 1 };
  throw new ServeConfigurationError(`${option} requires a value`);
}

function parsePort(value: string, source: string): number {
  if (!/^\d+$/.test(value))
    throw new ServeConfigurationError(
      `${source} must be an integer from 0 to 65535`,
    );
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535)
    throw new ServeConfigurationError(
      `${source} must be an integer from 0 to 65535`,
    );
  return port;
}

function parseAbsolutePath(value: string, source: string): string {
  if (!isAbsolute(value))
    throw new ServeConfigurationError(`${source} must be an absolute path`);
  try {
    return absolutePathSchema.parse(value);
  } catch {
    throw new ServeConfigurationError(`${source} must be an absolute path`);
  }
}

function parseHost(value: string, source: string): string {
  try {
    return listenHostSchema.parse(value);
  } catch {
    throw new ServeConfigurationError(
      `${source} must be a valid IP address or hostname`,
    );
  }
}

function parseArguments(args: readonly string[]): ServeArguments {
  const parsed: ServeArguments = { lan: false, help: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--lan') {
      parsed.lan = true;
      continue;
    }
    if (
      argument === '--data-directory' ||
      argument?.startsWith('--data-directory=')
    ) {
      const option = optionValue(args, index, '--data-directory');
      parsed.dataDirectory = parseAbsolutePath(
        option.value,
        '--data-directory',
      );
      index = option.nextIndex;
      continue;
    }
    if (argument === '--token-file' || argument?.startsWith('--token-file=')) {
      const option = optionValue(args, index, '--token-file');
      parsed.tokenFile = parseAbsolutePath(option.value, '--token-file');
      index = option.nextIndex;
      continue;
    }
    if (argument === '--host' || argument?.startsWith('--host=')) {
      const option = optionValue(args, index, '--host');
      parsed.host = parseHost(option.value, '--host');
      index = option.nextIndex;
      continue;
    }
    if (argument === '--port' || argument?.startsWith('--port=')) {
      const option = optionValue(args, index, '--port');
      parsed.port = parsePort(option.value, '--port');
      index = option.nextIndex;
      continue;
    }
    throw new ServeConfigurationError(`Unknown option: ${argument}`);
  }
  if (parsed.lan && parsed.host !== undefined)
    throw new ServeConfigurationError('--lan cannot be combined with --host');
  return parsed;
}

function dataDirectoryFor(
  parsed: ServeArguments,
  environment: ServeEnvironment,
  homeDirectory: string,
): string {
  if (parsed.dataDirectory) return parsed.dataDirectory;
  if (environment.PORCELAIN_DATA_DIRECTORY)
    return parseAbsolutePath(
      environment.PORCELAIN_DATA_DIRECTORY,
      'PORCELAIN_DATA_DIRECTORY',
    );
  return join(homeDirectory, '.porcelain');
}

function tokenFileFor(
  parsed: ServeArguments,
  environment: ServeEnvironment,
  dataDirectory: string,
): string {
  if (parsed.tokenFile) return parsed.tokenFile;
  if (environment.PORCELAIN_TOKEN_FILE)
    return parseAbsolutePath(
      environment.PORCELAIN_TOKEN_FILE,
      'PORCELAIN_TOKEN_FILE',
    );
  return join(dataDirectory, defaultTokenFileName);
}

export function parseServeSettings(
  args: readonly string[] = [],
  environment: ServeEnvironment = process.env,
  homeDirectory: string = homedir(),
  webRoot: string = join(repositoryRoot, 'apps/web/dist'),
): ServeSettings | { help: true } {
  const parsed = parseArguments(args);
  if (parsed.help) return { help: true };

  const dataDirectory = dataDirectoryFor(parsed, environment, homeDirectory);
  const tokenFile = tokenFileFor(parsed, environment, dataDirectory);
  if (parsePath(dataDirectory).root === dataDirectory)
    throw new ServeConfigurationError(
      'The data directory cannot be the filesystem root',
    );
  if (resolve(tokenFile) === resolve(dataDirectory, 'server.lock'))
    throw new ServeConfigurationError(
      'The token file cannot be the server ownership file',
    );

  const host = parsed.lan
    ? '0.0.0.0'
    : (parsed.host ??
      (environment.PORCELAIN_HOST
        ? parseHost(environment.PORCELAIN_HOST, 'PORCELAIN_HOST')
        : defaultHost));
  const port =
    parsed.port ??
    (environment.PORCELAIN_PORT
      ? parsePort(environment.PORCELAIN_PORT, 'PORCELAIN_PORT')
      : defaultPort);

  return {
    dataDirectory,
    tokenFile,
    host,
    port,
    webRoot: parseAbsolutePath(webRoot, 'web root'),
  };
}

function validToken(value: string): boolean {
  return value.length >= minimumTokenLength && tokenPattern.test(value);
}

async function inspectTokenFile(path: string): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw error;
    if (error instanceof Error && 'code' in error && error.code === 'ELOOP')
      throw new ServeConfigurationError(
        'The access token path must be a regular file, not a symlink',
      );
    throw new ServeConfigurationError(
      'Could not inspect the access token file',
    );
  }
  let token: string;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new ServeConfigurationError(
        'The access token path must be a regular file, not a symlink',
      );
    token = (await handle.readFile('utf8')).trim();
    await handle.chmod(0o600);
    const permissions = (await handle.stat()).mode & 0o777;
    if (permissions !== 0o600)
      throw new ServeConfigurationError(
        'The access token file must use mode 0600',
      );
  } catch (error) {
    if (error instanceof ServeConfigurationError) throw error;
    throw new ServeConfigurationError('Could not read the access token file');
  } finally {
    await handle.close();
  }
  if (!validToken(token))
    throw new ServeConfigurationError(
      'The access token file must contain a strong token of at least 32 safe characters',
    );
  return token;
}

/** Create or reuse the persistent bearer token without ever returning it to stdout. */
export async function ensureAccessToken(tokenFile: string): Promise<string> {
  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(tokenFile, 'wx', 0o600);
    const token = randomBytes(32).toString('base64url');
    try {
      await handle.writeFile(token, 'utf8');
      await handle.chmod(0o600);
    } finally {
      await handle.close();
    }
    return token;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw new ServeConfigurationError(
        'Could not create the access token file',
      );
    return inspectTokenFile(tokenFile);
  }
}

function pnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

async function buildWeb(
  repository: string,
  outputDirectory: string,
  signal: AbortSignal,
): Promise<void> {
  await runBuildCommand(
    pnpmCommand(),
    ['--filter', '@porcelain/web', 'exec', 'tsc', '--noEmit'],
    repository,
    signal,
  );
  await runBuildCommand(
    pnpmCommand(),
    [
      '--filter',
      '@porcelain/web',
      'exec',
      'vite',
      'build',
      '--outDir',
      outputDirectory,
    ],
    repository,
    signal,
  );
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error('Startup cancelled');
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, signal);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH'))
      throw error;
  }
}

function terminateProcessGroup(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  signalProcessGroup(child.pid, 'SIGTERM');
}

function processGroupExists(pid: number): boolean {
  if (process.platform === 'win32') return false;
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      'code' in error &&
      error.code === 'ESRCH'
    );
  }
}

/** Run a task-owned command and await its complete process group on cancellation. */
export async function runBuildCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  signal: AbortSignal,
  options: BuildCommandOptions = {},
): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
    });
    let aborted = false;
    let settled = false;
    let forceKill: NodeJS.Timeout | undefined;
    let groupPoll: NodeJS.Timeout | undefined;
    const cancellationGraceMs = options.cancellationGraceMs ?? 5_000;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
      if (forceKill) clearTimeout(forceKill);
      if (groupPoll) clearTimeout(groupPoll);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) rejectCommand(error);
      else resolveCommand();
    };
    const abort = () => {
      if (aborted) return;
      aborted = true;
      try {
        terminateProcessGroup(child);
      } catch (error) {
        finish(
          error instanceof Error ? error : new Error('Could not stop build'),
        );
        return;
      }
      forceKill = setTimeout(() => {
        if (child.pid !== undefined && processGroupExists(child.pid)) {
          try {
            signalProcessGroup(child.pid, 'SIGKILL');
          } catch {
            // The process may have exited between the check and the kill.
          }
        }
        finish(abortError(signal));
      }, cancellationGraceMs);
    };
    const settleAfterCancellation = () => {
      if (settled) return;
      if (
        process.platform === 'win32' ||
        child.pid === undefined ||
        !processGroupExists(child.pid)
      ) {
        finish(abortError(signal));
        return;
      }
      groupPoll = setTimeout(settleAfterCancellation, 25);
    };
    child.once('error', (error) => finish(error));
    child.once('close', (code, receivedSignal) => {
      if (aborted || signal.aborted) {
        settleAfterCancellation();
        return;
      }
      if (code === 0) {
        finish();
        return;
      }
      finish(
        new Error(
          receivedSignal
            ? `${command} terminated by ${receivedSignal}`
            : `${command} exited with status ${code ?? 'unknown'}`,
        ),
      );
    });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

async function waitForShutdown(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolveShutdown) =>
    signal.addEventListener('abort', () => resolveShutdown(), { once: true }),
  );
}

export async function runServe(
  settings: ServeSettings,
  signal: AbortSignal,
  dependencies: ServeDependencies = {},
): Promise<void> {
  const repository = dependencies.repositoryRoot ?? repositoryRoot;
  const output =
    dependencies.output ??
    ((message: string) => process.stdout.write(`${message}\n`));
  const build =
    dependencies.buildWeb ??
    ((buildSignal: AbortSignal, outputDirectory: string) =>
      buildWeb(repository, outputDirectory, buildSignal));
  const start = dependencies.startServer ?? startLocalServer;
  const temporaryWebRoot = dependencies.buildWeb
    ? undefined
    : await mkdtemp(join(tmpdir(), 'porcelain-web-'));
  const webRoot = temporaryWebRoot ?? settings.webRoot;
  try {
    await build(signal, webRoot);
    await assertWebRoot(webRoot);
    signal.throwIfAborted();
    const token = await ensureAccessToken(settings.tokenFile);
    signal.throwIfAborted();
    const server: StartedServer = await start(
      {
        dataDirectory: settings.dataDirectory,
        token,
        host: settings.host,
        port: settings.port,
        webRoot,
      },
      signal,
    );
    try {
      if (signal.aborted) return;
      output(`Porcelain listening at ${server.address}`);
      output(`Access token file: ${settings.tokenFile}`);
      await waitForShutdown(signal);
    } finally {
      await server.close();
    }
  } finally {
    if (temporaryWebRoot)
      await rm(temporaryWebRoot, { recursive: true, force: true });
  }
}

async function assertWebRoot(webRoot: string): Promise<void> {
  try {
    const index = await stat(join(webRoot, 'index.html'));
    if (index.isFile()) return;
  } catch {
    // Use one bounded diagnostic for a missing or malformed production build.
  }
  throw new ServeConfigurationError(
    'The web build did not produce an index.html file',
  );
}

export const serveHelp = `Usage: pnpm serve [options]

Starts the production web build and the persistent Porcelain server on one origin.

Options:
  --lan                    Listen on 0.0.0.0 for LAN access
  --host <host>            Listen host (default: 127.0.0.1)
  --port <port>            Listen port (default: 3000)
  --data-directory <path>  Persistent state directory (default: ~/.porcelain)
  --token-file <path>      Persistent access token file (default: <data-directory>/admin-token)
  -h, --help               Show this help
`;

function formatStartupError(error: unknown): string {
  if (error instanceof ServeConfigurationError) return error.message;
  if (error instanceof Error && error.name === 'DataDirectoryOwnedError')
    return error.message;
  return 'Porcelain could not start. Check the build, data directory, and port.';
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const parsed = parseServeSettings(process.argv.slice(2));
    if ('help' in parsed) {
      process.stdout.write(serveHelp);
      return;
    }
    await runServe(parsed, controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) {
      process.stderr.write(`${formatStartupError(error)}\n`);
      process.exitCode = 1;
    }
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
