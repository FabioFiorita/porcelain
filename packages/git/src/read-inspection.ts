import { GitCommandError } from './errors/git-command-error.ts';
import { GitInspectionTimeoutError } from './errors/git-inspection-timeout-error.ts';
import { InspectionLimitError } from './errors/inspection-limit-error.ts';
import {
  classifyGitFailure,
  type GitReadOptions,
  runGitRead,
} from './run-git.ts';

/**
 * Inspection reads over the one runner. Only the error mapping is inspection's
 * own: a read that outgrows its cap or its deadline is reported as such rather
 * than as a failed command.
 */
export async function runInspection(
  checkout: string,
  args: readonly string[],
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  try {
    return await runGitRead(checkout, args, signal, options);
  } catch (cause) {
    if (!(cause instanceof GitCommandError)) throw cause;
    switch (classifyGitFailure(cause.cause)) {
      case 'output-limit':
        throw new InspectionLimitError({ cause: cause.cause });
      case 'timeout':
        throw new GitInspectionTimeoutError(cause.cause);
      default:
        throw cause;
    }
  }
}
