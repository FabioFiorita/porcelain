import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { drainGitOutput } from '../shared/drain-git-output.ts';
import type { GitFailure } from '../shared/dtos/git-failure.ts';
import type { GitProcessResult } from '../shared/dtos/git-process-result.ts';
import { GitActionRejectedError } from './errors/git-action-rejected-error.ts';
import { gitActionEnvironment } from './git-action-environment.ts';
import { GIT_POLICY } from '../shared/run-git.ts';

const ACTION_CONFIG = [
  ...GIT_POLICY.sharedConfig,
  'maintenance.auto=false',
  'gc.auto=0',
];

function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return false;
    if (error instanceof Error && 'code' in error && error.code === 'EPERM')
      return true;
    throw error;
  }
}

async function descendantsRemain(pid: number): Promise<boolean> {
  const deadline = Date.now() + 250;
  while (signalGroup(pid, 0)) {
    if (Date.now() >= deadline) return true;
    await delay(10);
  }
  return false;
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

export class GitActionRunner {
  private readonly checkout: string;
  private unconfirmed = false;
  private progress: ((line: string) => void) | undefined;
  setProgressListener(listener?: (line: string) => void): void {
    this.progress = listener;
  }

  constructor(checkout: string) {
    this.checkout = checkout;
  }

  async execute(
    args: string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult> {
    if (this.unconfirmed)
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    signal.throwIfAborted();
    const child = spawn(
      'git',
      [
        ...GIT_POLICY.leadingArguments,
        '-C',
        this.checkout,
        ...ACTION_CONFIG.flatMap((entry) => ['-c', entry]),
        ...args,
      ],
      {
        env: {
          ...gitActionEnvironment(),
          ...(options?.indexFile ? { GIT_INDEX_FILE: options.indexFile } : {}),
        },
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const state = {
      started: false,
      interrupted: false,
      bytes: 0,
      failure: undefined as GitFailure | undefined,
    };
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    const interrupt = () => {
      state.interrupted = true;
      if (child.pid) signalGroup(child.pid, 'SIGKILL');
    };
    const consume = (chunk: Buffer, retain: boolean) => {
      state.bytes += chunk.length;
      if (state.bytes > GIT_POLICY.outputLimitBytes) {
        state.failure ??= 'output-limit';
        interrupt();
      } else if (retain) output.push(chunk);
    };
    child.stdout.on('data', (chunk: Buffer) => consume(chunk, true));
    let progressRemainder = '';
    child.stderr.on('data', (chunk: Buffer) => {
      consume(chunk, false);
      if (state.bytes <= GIT_POLICY.outputLimitBytes) errors.push(chunk);
      if (this.progress) {
        const parts = (progressRemainder + chunk.toString('utf8')).split(
          /[\r\n]/,
        );
        progressRemainder = parts.pop() ?? '';
        for (const line of parts) if (line.trim()) this.progress(line.trim());
      }
    });
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
        child.once('exit', (code) => resolve(code));
      });
      if (this.progress && progressRemainder.trim())
        this.progress(progressRemainder.trim());
      const cleanupDeadline = Date.now() + 5000;
      const cleanupSignal = AbortSignal.timeout(5000);
      const descendantsPresent = child.pid
        ? await descendantsRemain(child.pid)
        : false;
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
        stderr: Buffer.concat(errors),
        exitCode,
        started: state.started,
        interrupted: state.interrupted,
        descendantsStopped,
        ...(state.failure ? { failure: state.failure } : {}),
      };
    } finally {
      signal.removeEventListener('abort', interrupt);
    }
  }
}
