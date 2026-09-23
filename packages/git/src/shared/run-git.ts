import { execFile } from 'node:child_process';
import { devNull } from 'node:os';
import { promisify } from 'node:util';
import type { GitFailure } from './dtos/git-failure.ts';
import { GitCommandError } from './errors/git-command-error.ts';
import { baseGitEnvironment } from './git-environment.ts';

const execute = promisify(execFile);

export const GIT_POLICY = {
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

function readEnvironment(): NodeJS.ProcessEnv {
  return { ...baseGitEnvironment(), GIT_GRAFT_FILE: devNull };
}

const READ_CONFIG = [
  ...GIT_POLICY.sharedConfig,
  'core.quotePath=true',
  'diff.renameLimit=2000',
];

export type GitReadOptions = {
  maxBytes?: number;
  config?: readonly string[];
  input?: Buffer;
  leading?: readonly string[];
  timeoutMs?: number;
};

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
    task.child.stdin?.on('error', () => {});
    task.child.stdin?.end(input);
    const { stdout } = await task;
    return stdout;
  } catch (cause) {
    signal?.throwIfAborted();
    throw new GitCommandError(checkout, [...args], cause);
  }
}
