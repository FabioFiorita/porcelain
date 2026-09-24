import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runCli,
  startupFailureMessage,
} from '../apps/server/src/bootstrap/main.ts';
import { parseCliArguments } from '../apps/server/src/cli/arguments.ts';
import { installShutdownSignals } from '../apps/server/src/cli/signals.ts';
import { ServeConfigurationError } from '../apps/server/src/config/errors/serve-configuration-error.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

async function assertWebRoot(webRoot: string): Promise<void> {
  try {
    const index = await stat(join(webRoot, 'index.html'));
    if (index.isFile()) return;
  } catch {}
  throw new ServeConfigurationError(
    'The web build did not produce an index.html file',
  );
}

function servesLocally(args: readonly string[]): boolean {
  try {
    return parseCliArguments(args, process.env, homedir()).command === 'serve';
  } catch {
    return false;
  }
}

async function buildInto(webRoot: string): Promise<boolean> {
  const controller = new AbortController();
  const removeShutdownSignals = installShutdownSignals(controller);
  try {
    await buildWeb(repositoryRoot, webRoot, controller.signal);
    await assertWebRoot(webRoot);
    return !controller.signal.aborted;
  } catch (error) {
    if (!controller.signal.aborted) {
      process.stderr.write(`${startupFailureMessage(error)}\n`);
      process.exitCode = 1;
    }
    return false;
  } finally {
    removeShutdownSignals();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!servesLocally(args)) {
    await runCli(args);
    return;
  }
  const webRoot = await mkdtemp(join(tmpdir(), 'porcelain-web-'));
  try {
    if (await buildInto(webRoot)) await runCli(args, process.env, { webRoot });
  } finally {
    await rm(webRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
