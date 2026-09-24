import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import { runGitRead } from '../../shared/commands/run-git.ts';

const remoteExitCodes = { noSuchRemote: 2 };

export async function readOriginUrl(
  checkout: string,
  limits: GitLimits,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const output = await runGitRead(
      checkout,
      ['remote', 'get-url', 'origin'],
      limits,
      signal,
    );
    const url = output.toString('utf8').trim();
    return url === '' ? null : url;
  } catch (failure) {
    if (
      failure instanceof GitCommandError &&
      failure.exitCode === remoteExitCodes.noSuchRemote
    )
      return null;
    throw failure;
  }
}
