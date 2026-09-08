import { execFile } from 'node:child_process';
import { devNull } from 'node:os';
import { promisify } from 'node:util';
import { GitCommandError } from './errors/git-command-error.ts';

const execute = promisify(execFile);

export async function executeCommand(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
  strictRead = false,
): Promise<string> {
  signal?.throwIfAborted();
  try {
    const { stdout } = await execute('git', ['-C', checkout, ...args], {
      encoding: 'buffer',
      signal,
      killSignal: 'SIGKILL',
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...(strictRead
          ? Object.fromEntries(
              Object.entries(process.env).filter(
                ([key]) => !key.startsWith('GIT_'),
              ),
            )
          : process.env),
        GIT_OPTIONAL_LOCKS: '0',
        GIT_CONFIG_PARAMETERS: undefined,
        GIT_CONFIG_COUNT: '0',
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
        GIT_COMMON_DIR: undefined,
        ...(strictRead
          ? {
              GIT_NO_LAZY_FETCH: '1',
              GIT_GRAFT_FILE: devNull,
              GIT_SHALLOW_FILE: undefined,
              GIT_TERMINAL_PROMPT: '0',
              GIT_OBJECT_DIRECTORY: undefined,
              GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
            }
          : {}),
      },
    });
    return strictRead
      ? new TextDecoder('utf8', { fatal: true }).decode(stdout)
      : stdout.toString('utf8');
  } catch (cause) {
    signal?.throwIfAborted();
    throw new GitCommandError(checkout, args, cause);
  }
}
