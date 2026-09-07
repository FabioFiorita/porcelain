import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitCommandError } from './errors/git-command-error.ts';

const execute = promisify(execFile);

export async function executeCommand(
  checkout: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  try {
    const { stdout } = await execute('git', ['-C', checkout, ...args], {
      encoding: 'utf8',
      signal,
      killSignal: 'SIGKILL',
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: '0',
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
        GIT_COMMON_DIR: undefined,
      },
    });
    return stdout;
  } catch (cause) {
    signal?.throwIfAborted();
    throw new GitCommandError(checkout, args, cause);
  }
}
