import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitCommandError } from './errors/git-command-error.ts';
import { GitInspectionTimeoutError } from './errors/git-inspection-timeout-error.ts';
import { InspectionLimitError } from './errors/inspection-limit-error.ts';

const execute = promisify(execFile);

export async function executeInspection(
  checkout: string,
  args: string[],
  maxBytes: number,
  signal?: AbortSignal,
  config: string[] = [],
  input?: Buffer,
): Promise<Buffer> {
  signal?.throwIfAborted();
  try {
    const task = execute(
      'git',
      [
        '--no-replace-objects',
        '-C',
        checkout,
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.untrackedCache=false',
        '-c',
        'core.quotePath=true',
        '-c',
        'diff.renameLimit=2000',
        ...config.flatMap((entry) => ['-c', entry]),
        ...args,
      ],
      {
        encoding: 'buffer',
        signal,
        killSignal: 'SIGKILL',
        timeout: 10_000,
        maxBuffer: maxBytes,
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: '0',
          GIT_NO_REPLACE_OBJECTS: '1',
          GIT_NO_LAZY_FETCH: '1',
          GIT_TERMINAL_PROMPT: '0',
          GIT_CONFIG_PARAMETERS: undefined,
          GIT_CONFIG_COUNT: '0',
          GIT_DIR: undefined,
          GIT_WORK_TREE: undefined,
          GIT_COMMON_DIR: undefined,
          GIT_INDEX_FILE: undefined,
          GIT_OBJECT_DIRECTORY: undefined,
          GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
          GIT_EXTERNAL_DIFF: undefined,
          GIT_DIFF_OPTS: undefined,
          GIT_LITERAL_PATHSPECS: undefined,
          GIT_GLOB_PATHSPECS: undefined,
          GIT_NOGLOB_PATHSPECS: undefined,
          GIT_ICASE_PATHSPECS: undefined,
        },
      },
    );
    // A failed command can close its input early; execFile reports its exit.
    task.child.stdin?.on('error', () => {});
    task.child.stdin?.end(input);
    const { stdout } = await task;
    return stdout;
  } catch (cause) {
    signal?.throwIfAborted();
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
    ) {
      throw new InspectionLimitError({ cause });
    }
    if (cause instanceof Error && 'killed' in cause && cause.killed === true) {
      throw new GitInspectionTimeoutError(cause);
    }
    throw new GitCommandError(checkout, args, cause);
  }
}
