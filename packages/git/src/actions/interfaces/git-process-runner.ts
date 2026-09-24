import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitProcessResult } from '../../shared/run-git.ts';

export type GitProcessRunner = {
  readonly limits: GitLimits;
  execute(
    args: readonly string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult>;
};
