import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { runGitRead } from '../../shared/run-git.ts';

const NO_SUCH_REMOTE = 2;

export async function readOriginUrl(
  checkout: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const output = await runGitRead(
      checkout,
      ['remote', 'get-url', 'origin'],
      signal,
    );
    const url = output.toString('utf8').trim();
    return url === '' ? null : url;
  } catch (failure) {
    signal?.throwIfAborted();
    const cause = failure instanceof GitCommandError ? failure.cause : failure;
    if (
      cause instanceof Error &&
      'code' in cause &&
      cause.code === NO_SUCH_REMOTE
    )
      return null;
    throw failure;
  }
}
