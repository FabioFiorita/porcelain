import { GitOutputLimitError } from '../../shared/errors/git-output-limit-error.ts';
import { type GitReadOptions, runGitRead } from '../../shared/run-git.ts';
import { InspectionLimitError } from '../errors/inspection-limit-error.ts';

export async function runInspection(
  checkout: string,
  args: readonly string[],
  signal?: AbortSignal,
  options: GitReadOptions = {},
): Promise<Buffer> {
  try {
    return await runGitRead(checkout, args, signal, options);
  } catch (cause) {
    if (cause instanceof GitOutputLimitError)
      throw new InspectionLimitError({ cause });
    throw cause;
  }
}
