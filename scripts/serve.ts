import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installShutdownSignals,
  parseCliArguments,
  reportStatus,
  runLocalServer,
  ServeConfigurationError,
  type ServeSettings,
  serveHelp,
  statusExitCodes,
} from '../apps/server/src/cli/index.ts';
import type { StartServer } from '../apps/server/src/cli/launcher.ts';

export {
  installShutdownSignals,
  parseCliArguments,
  ServeConfigurationError,
  type ServeSettings,
  serveHelp,
} from '../apps/server/src/cli/index.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type ServeDependencies = {
  buildWeb?: (signal: AbortSignal, outputDirectory: string) => Promise<void>;
  startServer?: StartServer;
  output?: (message: string) => void;
  repositoryRoot?: string;
};

export type BuildCommandOptions = {
  cancellationGraceMs?: number;
};

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
          } catch {}
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
  const temporaryWebRoot = dependencies.buildWeb
    ? undefined
    : await mkdtemp(join(tmpdir(), 'porcelain-web-'));
  const webRoot = temporaryWebRoot ?? settings.webRoot;
  try {
    await build(signal, webRoot);
    await assertWebRoot(webRoot);
    signal.throwIfAborted();
    await runLocalServer(
      { ...settings, webRoot },
      signal,
      dependencies.startServer
        ? { startServer: dependencies.startServer, output }
        : { output },
    );
  } finally {
    if (temporaryWebRoot)
      await rm(temporaryWebRoot, { recursive: true, force: true });
  }
}

async function assertWebRoot(webRoot: string): Promise<void> {
  try {
    const index = await stat(join(webRoot, 'index.html'));
    if (index.isFile()) return;
  } catch {}
  throw new ServeConfigurationError(
    'The web build did not produce an index.html file',
  );
}

function formatStartupError(error: unknown): string {
  if (error instanceof ServeConfigurationError) return error.message;
  if (
    error instanceof Error &&
    (error.name === 'DataDirectoryOwnedError' ||
      error.name === 'DataDirectoryInsecureError' ||
      error.name === 'SocketPathTooLongError')
  )
    return error.message;
  return 'Porcelain could not start. Check the build, data directory, and port.';
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const removeShutdownSignals = installShutdownSignals(controller);
  try {
    const parsed = parseCliArguments(
      process.argv.slice(2),
      process.env,
      homedir(),
    );
    if (parsed.command === 'help') {
      process.stdout.write(serveHelp);
      return;
    }
    if (parsed.command === 'status') {
      const code = await reportStatus(parsed.settings, {
        stdout: (message) => process.stdout.write(message),
        stderr: (message) => process.stderr.write(message),
      });
      if (code !== statusExitCodes.running) process.exitCode = code;
      return;
    }
    if (parsed.command !== 'serve') {
      process.stderr.write(
        `Use the installed porcelain command for ${parsed.command}.\n`,
      );
      process.exitCode = 1;
      return;
    }
    await runServe(parsed.settings, controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) {
      process.stderr.write(`${formatStartupError(error)}\n`);
      process.exitCode = 1;
    }
  } finally {
    removeShutdownSignals();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
