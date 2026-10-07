import { Effect } from 'effect';
import type { ChildProcessSpawner } from 'effect/process';
import { NodeServices } from '@effect/platform-node';
import { devNull } from 'node:os';
import { runCommand } from '@porcelain/process';
import { GitCommandError } from '../errors/git-command-error.ts';
import { GitOutputLimitError } from '../errors/git-output-limit-error.ts';
import { GitTimeoutError } from '../errors/git-timeout-error.ts';
import type { GitLimits } from '../dtos/git-limits.ts';

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

export const gitRead = Effect.fn('Git.read')(function* (
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  options: GitReadOptions = {},
): Effect.fn.Return<
  Buffer,
  GitCommandError | GitOutputLimitError | GitTimeoutError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const output = yield* runCommand(
    readCommand(checkout, args, limits, options),
  ).pipe(Effect.mapError((cause) => notStarted(checkout, args, cause)));
  const completed =
    output.stopped === undefined || output.stopped === 'lingering';
  if (completed && output.exitCode === 0) return output.stdout;
  if (output.stopped === 'output-limit')
    return yield* new GitOutputLimitError();
  if (output.stopped === 'deadline') return yield* new GitTimeoutError();
  return yield* new GitCommandError({
    checkout,
    args,
    exitCode: output.exitCode,
    stderr: output.stderr.toString('utf8'),
  });
});

export const gitWrite = Effect.fn('Git.write')(function* (
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  options: GitWriteOptions = {},
): Effect.fn.Return<
  GitProcessResult,
  GitCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const progress = options.onProgress
    ? progressReader(options.onProgress)
    : undefined;
  const output = yield* runCommand(
    writeCommand(checkout, args, limits, options, progress),
  ).pipe(Effect.mapError((cause) => notStarted(checkout, args, cause)));
  progress?.finish();
  return processResult(output);
});

export async function runGitRead(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  signal?.throwIfAborted();
  try {
    return await Effect.runPromise(
      gitRead(checkout, args, limits, options).pipe(
        Effect.provide(NodeServices.layer),
      ),
      { signal },
    );
  } catch (failure) {
    signal?.throwIfAborted();
    throw failure;
  }
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
  const output = await Effect.runPromise(
    runCommand(
      writeCommand(checkout, args, limits, options, progress),
      signal,
    ).pipe(Effect.provide(NodeServices.layer)),
  );
  progress?.finish();
  return processResult(output);
}

type CommandOutput = Effect.Success<ReturnType<typeof runCommand>>;
type ProgressReader = ReturnType<typeof progressReader>;

function readCommand(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  options: GitReadOptions,
) {
  return {
    command: 'git',
    args: gitArguments('read', checkout, args, limits, options),
    env: gitEnvironment('read'),
    stdin: options.input,
    timeoutMs: options.timeoutMs ?? limits.readTimeoutMs,
    maxBytes: options.maxBytes ?? limits.outputBytes,
    processGroup: limits.processGroup,
  };
}

function writeCommand(
  checkout: string,
  args: readonly string[],
  limits: GitLimits,
  options: GitWriteOptions,
  progress: ProgressReader | undefined,
) {
  return {
    command: 'git',
    args: gitArguments('write', checkout, args, limits, {}),
    env: gitEnvironment('write', options.indexFile),
    stdin: options.input,
    maxBytes: options.maxBytes ?? limits.outputBytes,
    processGroup: limits.processGroup,
    onStderr: progress?.read,
  };
}

function notStarted(
  checkout: string,
  args: readonly string[],
  cause: unknown,
): GitCommandError {
  return new GitCommandError({
    checkout,
    args,
    exitCode: undefined,
    stderr: '',
    cause,
  });
}

function processResult(output: CommandOutput): GitProcessResult {
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

function modeConfig(mode: GitMode, limits: GitLimits): readonly string[] {
  return mode === 'read'
    ? [
        'core.fsmonitor=false',
        'core.untrackedCache=false',
        'core.quotePath=true',
        `diff.renameLimit=${limits.renames.limit}`,
      ]
    : [
        'core.fsmonitor=false',
        'core.untrackedCache=false',
        'maintenance.auto=false',
        'gc.auto=0',
      ];
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
  limits: GitLimits,
  options: Pick<GitReadOptions, 'config' | 'leading'>,
): string[] {
  return [
    '--no-replace-objects',
    ...(options.leading ?? []),
    '-C',
    checkout,
    ...[...modeConfig(mode, limits), ...(options.config ?? [])].flatMap(
      (entry) => ['-c', entry],
    ),
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
