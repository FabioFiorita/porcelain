import { devNull } from 'node:os';
import { runCommand } from '@porcelain/process';
import { GitCommandError } from './errors/git-command-error.ts';
import { GitOutputLimitError } from './errors/git-output-limit-error.ts';
import { GitTimeoutError } from './errors/git-timeout-error.ts';
import type { GitLimits } from './dtos/git-limits.ts';

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

export async function runGitRead(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  signal?.throwIfAborted();
  const output = await runCommand(
    {
      command: 'git',
      args: gitArguments('read', checkout, args, options),
      env: gitEnvironment('read'),
      stdin: options.input,
      timeoutMs: options.timeoutMs ?? limits.readTimeoutMs,
      maxBytes: options.maxBytes ?? limits.outputBytes,
    },
    signal,
  ).catch((cause: unknown) => {
    signal?.throwIfAborted();
    throw new GitCommandError(
      checkout,
      args,
      { exitCode: undefined, stderr: '' },
      { cause },
    );
  });
  const completed =
    output.stopped === undefined || output.stopped === 'lingering';
  if (completed && output.exitCode === 0) return output.stdout;
  signal?.throwIfAborted();
  if (output.stopped === 'output-limit') throw new GitOutputLimitError();
  if (output.stopped === 'deadline') throw new GitTimeoutError();
  throw new GitCommandError(checkout, args, {
    exitCode: output.exitCode,
    stderr: output.stderr.toString('utf8'),
  });
}

export async function runGitWrite(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal: AbortSignal,
  options: GitWriteOptions = {},
): Promise<GitProcessResult> {
  signal.throwIfAborted();
  const progress = options.onProgress
    ? progressReader(options.onProgress)
    : undefined;
  const output = await runCommand(
    {
      command: 'git',
      args: gitArguments('write', checkout, args, {}),
      env: gitEnvironment('write', options.indexFile),
      stdin: options.input,
      maxBytes: options.maxBytes ?? limits.outputBytes,
      onStderr: progress?.read,
    },
    signal,
  );
  progress?.finish();
  return {
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: output.exitCode ?? null,
    started: true,
    interrupted: output.stopped !== undefined || !output.groupStopped,
    descendantsStopped: output.groupStopped,
    ...(output.stopped === 'output-limit' ? { failure: 'output-limit' } : {}),
  };
}

function progressReader(onProgress: (line: string) => void) {
  let remainder = '';
  return {
    read: (chunk: Buffer) => {
      const parts = (remainder + chunk.toString('utf8')).split(/[\r\n]/);
      remainder = parts.pop() ?? '';
      for (const line of parts) if (line.trim()) onProgress(line.trim());
    },
    finish: () => {
      if (remainder.trim()) onProgress(remainder.trim());
    },
  };
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
    GIT_ASKPASS: '',
    SSH_ASKPASS: '',
    SSH_ASKPASS_REQUIRE: 'never',
    GIT_EDITOR: ':',
    GIT_SEQUENCE_EDITOR: ':',
    LC_ALL: 'C',
    LANG: 'C',
  };
}
