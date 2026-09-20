import { GitCommandError } from '../errors/git-command-error.ts';
import { runGitRead } from '../run-git.ts';

/** Git's exit code for a remote that is not configured. */
const NO_SUCH_REMOTE = 2;

/**
 * The URL of the `origin` remote, or null when there is no such remote.
 *
 * `git remote get-url` rather than `git config --get remote.origin.url`: only
 * the former applies `url.*.insteadOf`, so the latter would name a project
 * after an unexpanded alias such as `gh:team/repo.git`.
 *
 * Null means Git said there is no origin. Any other failure is a failure — a
 * repository that could not be read must not quietly become a folder name.
 */
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
