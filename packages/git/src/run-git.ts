import { execFile, spawn } from 'node:child_process';
import { devNull } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { drainGitOutput } from './drain-git-output.ts';
import type { GitFailure } from './dtos/git-failure.ts';
import type { GitProcessResult } from './dtos/git-process-result.ts';
import { GitActionRejectedError } from './errors/git-action-rejected-error.ts';
import { GitCommandError } from './errors/git-command-error.ts';
import { gitActionEnvironment } from './git-action-environment.ts';
import { baseGitEnvironment } from './git-environment.ts';

const execute = promisify(execFile);

/**
 * The rules every Git process obeys, whichever mode runs it. Only the strategy
 * differs: reads go through `execFile` and are bounded by the runner, while
 * actions are spawned into their own process group and take their deadline
 * from the caller, because a push or a hook may legitimately run for minutes.
 */
const GIT_POLICY = {
  outputLimitBytes: 4 * 1024 * 1024,
  readDeadlineMs: 10_000,
  leadingArguments: ['--no-replace-objects'],
  sharedConfig: ['core.fsmonitor=false', 'core.untrackedCache=false'],
} as const;

export function classifyGitFailure(cause: unknown): GitFailure {
  if (!(cause instanceof Error)) return 'other';
  const code = 'code' in cause ? cause.code : undefined;
  if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'output-limit';
  if (code === 'ERR_ENCODING_INVALID_ENCODED_DATA') return 'invalid-encoding';
  if ('killed' in cause && cause.killed === true) return 'timeout';
  if (typeof code === 'number') return 'exit';
  return 'other';
}

/** A read additionally refuses grafts. */
function readEnvironment(): NodeJS.ProcessEnv {
  return { ...baseGitEnvironment(), GIT_GRAFT_FILE: devNull };
}

const READ_CONFIG = [
  ...GIT_POLICY.sharedConfig,
  'core.quotePath=true',
  // Renames stay classified the same way however many candidates a change has.
  'diff.renameLimit=2000',
];

const ACTION_CONFIG = [
  ...GIT_POLICY.sharedConfig,
  'maintenance.auto=false',
  'gc.auto=0',
];

export type GitReadOptions = {
  /** Output cap; the process is killed once it is exceeded. */
  maxBytes?: number;
  /** Extra `-c` settings for this command. */
  config?: readonly string[];
  /** Written to the command's standard input. */
  input?: Buffer;
  /** Extra arguments before the subcommand, e.g. `--literal-pathspecs`. */
  leading?: readonly string[];
  /** Overrides the policy's deadline for this read. */
  timeoutMs?: number;
};

/**
 * The one way to run a Git command that only reads. Callers classify failures
 * with {@link classifyGitFailure} and raise their own domain errors.
 */
export async function runGitRead(
  checkout: string,
  args: readonly string[],
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  signal?.throwIfAborted();
  const {
    maxBytes = GIT_POLICY.outputLimitBytes,
    config = [],
    input,
    leading = [],
    timeoutMs = GIT_POLICY.readDeadlineMs,
  } = options;
  try {
    const task = execute(
      'git',
      [
        ...GIT_POLICY.leadingArguments,
        ...leading,
        '-C',
        checkout,
        ...[...READ_CONFIG, ...config].flatMap((entry) => ['-c', entry]),
        ...args,
      ],
      {
        encoding: 'buffer',
        ...(signal ? { signal } : {}),
        killSignal: 'SIGKILL',
        timeout: timeoutMs,
        maxBuffer: maxBytes,
        env: readEnvironment(),
      },
    );
    // A failed command can close its input early; execFile reports its exit.
    task.child.stdin?.on('error', () => {});
    task.child.stdin?.end(input);
    const { stdout } = await task;
    return stdout;
  } catch (cause) {
    signal?.throwIfAborted();
    throw new GitCommandError(checkout, [...args], cause);
  }
}

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

/**
 * Action mode of the same runner. A write can start hooks that outlive the
 * command, so it runs in its own process group, kills the group, confirms the
 * descendants are gone, and refuses further work when it cannot.
 */
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
        // The one limit both modes share, named the way a read names it.
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
        // Exit, rather than close: a descendant may inherit the pipes indefinitely.
        child.once('exit', (code) => resolve(code));
      });
      if (this.progress && progressRemainder.trim())
        this.progress(progressRemainder.trim());
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
