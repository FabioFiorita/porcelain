import { execFile, spawn } from 'node:child_process';
import { devNull } from 'node:os';
import type { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { GitCommandError } from './errors/git-command-error.ts';
import { GitOutputLimitError } from './errors/git-output-limit-error.ts';
import { GitTimeoutError } from './errors/git-timeout-error.ts';

type GitMode = 'read' | 'write';

export type GitReadOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  config?: readonly string[];
  leading?: readonly string[];
  input?: Buffer;
};

export type GitWriteOptions = {
  maxBytes?: number;
  input?: string;
  indexFile?: string;
  onProgress?: (line: string) => void;
};

export type GitProcessResult = {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number | null;
  started: boolean;
  interrupted: boolean;
  descendantsStopped: boolean;
  failure?: 'output-limit';
};

const OUTPUT_LIMIT_BYTES = 4 * 1024 * 1024;
const READ_DEADLINE_MS = 10_000;
const CLEANUP_DEADLINE_MS = 5000;

const MODE_CONFIG: Record<GitMode, readonly string[]> = {
  read: [
    'core.fsmonitor=false',
    'core.untrackedCache=false',
    'core.quotePath=true',
    'diff.renameLimit=2000',
  ],
  write: [
    'core.fsmonitor=false',
    'core.untrackedCache=false',
    'maintenance.auto=false',
    'gc.auto=0',
  ],
};

const execute = promisify(execFile);

export async function runGitRead(
  checkout: string,
  args: readonly string[],
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  signal?.throwIfAborted();
  try {
    const task = execute('git', gitArguments('read', checkout, args, options), {
      encoding: 'buffer',
      ...(signal ? { signal } : {}),
      killSignal: 'SIGKILL',
      timeout: options.timeoutMs ?? READ_DEADLINE_MS,
      maxBuffer: options.maxBytes ?? OUTPUT_LIMIT_BYTES,
      env: gitEnvironment('read'),
    });
    task.child.stdin?.on('error', () => {});
    task.child.stdin?.end(options.input);
    const { stdout } = await task;
    return stdout;
  } catch (cause) {
    signal?.throwIfAborted();
    throw readFailure(checkout, args, cause);
  }
}

export async function runGitWrite(
  checkout: string,
  args: readonly string[],
  signal: AbortSignal,
  options: GitWriteOptions = {},
): Promise<GitProcessResult> {
  signal.throwIfAborted();
  const limit = options.maxBytes ?? OUTPUT_LIMIT_BYTES;
  const child = spawn('git', gitArguments('write', checkout, args, {}), {
    env: gitEnvironment('write', options.indexFile),
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const state = {
    started: false,
    interrupted: false,
    bytes: 0,
    failure: undefined as GitProcessResult['failure'],
  };
  const output: Buffer[] = [];
  const errors: Buffer[] = [];
  const interrupt = () => {
    state.interrupted = true;
    if (child.pid) signalGroup(child.pid, 'SIGKILL');
  };
  const consume = (chunk: Buffer, retained: Buffer[]) => {
    state.bytes += chunk.length;
    if (state.bytes > limit) {
      state.failure ??= 'output-limit';
      interrupt();
    } else retained.push(chunk);
  };
  child.stdout.on('data', (chunk: Buffer) => consume(chunk, output));
  let progressRemainder = '';
  child.stderr.on('data', (chunk: Buffer) => {
    consume(chunk, errors);
    if (!options.onProgress) return;
    const parts = (progressRemainder + chunk.toString('utf8')).split(/[\r\n]/);
    progressRemainder = parts.pop() ?? '';
    for (const line of parts) if (line.trim()) options.onProgress(line.trim());
  });
  child.stdin.on('error', () => {});
  child.stdin.end(options.input);
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
    if (options.onProgress && progressRemainder.trim())
      options.onProgress(progressRemainder.trim());
    const cleanupDeadline = Date.now() + CLEANUP_DEADLINE_MS;
    if (child.pid && (await descendantsRemain(child.pid)))
      state.interrupted = true;
    const groupStopped = child.pid
      ? await stopDescendants(child.pid, cleanupDeadline)
      : true;
    const drained = await drain(
      child.stdout,
      child.stderr,
      AbortSignal.timeout(CLEANUP_DEADLINE_MS),
    );
    if (!drained) state.interrupted = true;
    child.stdout.destroy();
    child.stderr.destroy();
    return {
      stdout: Buffer.concat(output),
      stderr: Buffer.concat(errors),
      exitCode,
      started: state.started,
      interrupted: state.interrupted,
      descendantsStopped: groupStopped && drained,
      ...(state.failure ? { failure: state.failure } : {}),
    };
  } finally {
    signal.removeEventListener('abort', interrupt);
  }
}

function gitArguments(
  mode: GitMode,
  checkout: string,
  args: readonly string[],
  options: Pick<GitReadOptions, 'config' | 'leading'>,
): string[] {
  return [
    '--no-replace-objects',
    ...(options.leading ?? []),
    '-C',
    checkout,
    ...[...MODE_CONFIG[mode], ...(options.config ?? [])].flatMap((entry) => [
      '-c',
      entry,
    ]),
    ...args,
  ];
}

function gitEnvironment(mode: GitMode, indexFile?: string): NodeJS.ProcessEnv {
  const base = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    ),
    GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_COUNT: '0',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...(indexFile ? { GIT_INDEX_FILE: indexFile } : {}),
  };
  if (mode === 'read') return { ...base, GIT_GRAFT_FILE: devNull };
  return {
    ...base,
    GCM_INTERACTIVE: 'never',
    GIT_ASKPASS: '/usr/bin/false',
    SSH_ASKPASS: '/usr/bin/false',
    SSH_ASKPASS_REQUIRE: 'never',
    GIT_EDITOR: '/usr/bin/false',
    GIT_SEQUENCE_EDITOR: '/usr/bin/false',
    LC_ALL: 'C',
    LANG: 'C',
  };
}

function readFailure(
  checkout: string,
  args: readonly string[],
  cause: unknown,
): Error {
  const code =
    cause instanceof Error && 'code' in cause ? cause.code : undefined;
  if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
    return new GitOutputLimitError({ cause });
  if (cause instanceof Error && 'killed' in cause && cause.killed === true)
    return new GitTimeoutError({ cause });
  const stderr =
    cause instanceof Error && 'stderr' in cause ? cause.stderr : '';
  return new GitCommandError(
    checkout,
    args,
    {
      exitCode: typeof code === 'number' ? code : undefined,
      stderr: Buffer.isBuffer(stderr)
        ? stderr.toString('utf8')
        : typeof stderr === 'string'
          ? stderr
          : '',
    },
    { cause },
  );
}

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

async function drain(
  stdout: Readable,
  stderr: Readable,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    await Promise.all([
      finished(stdout, { signal, cleanup: true }),
      finished(stderr, { signal, cleanup: true }),
    ]);
    return true;
  } catch {
    return false;
  }
}
