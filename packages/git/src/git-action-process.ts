import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { drainGitOutput } from './drain-git-output.ts';
import type { GitProcessResult } from './dtos/git-process-result.ts';
import { GitActionRejectedError } from './errors/git-action-rejected-error.ts';
import { gitActionEnvironment } from './git-action-environment.ts';

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return false;
    // A group can remain visible but unsignalable while descendants are reaped.
    // Treat EPERM as still present, never as successful cleanup.
    if (error instanceof Error && 'code' in error && error.code === 'EPERM')
      return true;
    throw error;
  }
}

async function stopDescendants(
  pid: number,
  deadline: number,
): Promise<boolean> {
  if (!signalGroup(pid, 0)) return true;
  signalGroup(pid, 'SIGKILL');
  while (Date.now() < deadline) {
    if (!signalGroup(pid, 0)) return true;
    await delay(20);
  }
  return false;
}

export class GitActionProcess {
  private readonly checkout: string;
  private unconfirmed = false;
  constructor(checkout: string) {
    this.checkout = checkout;
  }

  async execute(
    args: string[],
    signal: AbortSignal,
    input?: string,
  ): Promise<GitProcessResult> {
    if (this.unconfirmed)
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    signal.throwIfAborted();
    const child = spawn(
      'git',
      [
        '--no-replace-objects',
        '-C',
        this.checkout,
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.untrackedCache=false',
        '-c',
        'maintenance.auto=false',
        '-c',
        'gc.auto=0',
        ...args,
      ],
      {
        env: gitActionEnvironment(),
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const state = { started: false, interrupted: false, bytes: 0 };
    const output: Buffer[] = [];
    const interrupt = () => {
      state.interrupted = true;
      if (child.pid) signalGroup(child.pid, 'SIGKILL');
    };
    const consume = (chunk: Buffer, retain: boolean) => {
      state.bytes += chunk.length;
      if (state.bytes > 4 * 1024 * 1024) interrupt();
      else if (retain) output.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => consume(chunk, true));
    child.stderr.on('data', (chunk: Buffer) => consume(chunk, false));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    signal.addEventListener('abort', interrupt, { once: true });
    if (signal.aborted) interrupt();
    try {
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.once('spawn', () => {
          state.started = true;
        });
        child.once('error', reject);
        // Exit, rather than close: a descendant may inherit the pipes indefinitely.
        child.once('exit', (code) => resolve(code));
      });
      const cleanupDeadline = Date.now() + 5000;
      const cleanupSignal = AbortSignal.timeout(5000);
      const descendantsPresent = child.pid ? signalGroup(child.pid, 0) : false;
      if (descendantsPresent) state.interrupted = true;
      const groupStopped = child.pid
        ? await stopDescendants(child.pid, cleanupDeadline)
        : true;
      const drained = await drainGitOutput(
        child.stdout,
        child.stderr,
        cleanupSignal,
      );
      if (!drained) state.interrupted = true;
      const descendantsStopped = groupStopped && drained;
      child.stdout.destroy();
      child.stderr.destroy();
      if (!descendantsStopped) {
        this.unconfirmed = true;
        throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
      }
      return {
        stdout: Buffer.concat(output),
        exitCode,
        started: state.started,
        interrupted: state.interrupted,
        descendantsStopped,
      };
    } finally {
      signal.removeEventListener('abort', interrupt);
    }
  }
}
